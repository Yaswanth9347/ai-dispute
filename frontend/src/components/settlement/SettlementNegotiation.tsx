'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settlementService, SettlementProposal, CreateProposalData } from '@/services/settlementService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { 
  DollarSign, 
  Clock, 
  Users, 
  MessageSquare, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  PlusCircle,
  Lightbulb
} from 'lucide-react';
import { toast } from 'sonner';
import getSocket from '@/lib/socket';

interface SettlementNegotiationProps {
  caseId: string;
}

export default function SettlementNegotiation({ caseId }: SettlementNegotiationProps) {
  const [activeTab, setActiveTab] = useState('proposals');
  const [showCreateProposal, setShowCreateProposal] = useState(false);
  const [newProposal, setNewProposal] = useState<Partial<CreateProposalData>>({
    amount: 0,
    terms: '',
    conditions: []
  });

  const queryClient = useQueryClient();

  // Fetch proposals for this case
  const { data: proposalsResponse, isLoading: loadingProposals } = useQuery({
    queryKey: ['settlement-proposals', caseId],
    queryFn: () => settlementService.getProposals(caseId),
    // switched to socket-driven updates; no polling
    refetchInterval: false,
  });

  // Fetch negotiation session
  const { data: sessionResponse } = useQuery({
    queryKey: ['negotiation-session', caseId],
    queryFn: () => settlementService.getNegotiationSession(caseId),
  });

  // Fetch analytics
  const { data: analyticsResponse } = useQuery({
    queryKey: ['settlement-analytics', caseId],
    queryFn: () => settlementService.getAnalytics(caseId),
  });

  // Fetch AI suggestion
  const { data: aiSuggestionResponse, refetch: getAISuggestion } = useQuery({
    queryKey: ['ai-suggestion', caseId],
    queryFn: () => settlementService.getAISuggestion(caseId),
    enabled: false, // Only fetch when requested
  });

  // Create proposal mutation
  const createProposalMutation = useMutation({
    mutationFn: (data: CreateProposalData) => settlementService.createProposal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlement-proposals', caseId] });
      toast.success('Settlement proposal created successfully');
      setShowCreateProposal(false);
      setNewProposal({ amount: 0, terms: '', conditions: [] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create proposal');
    },
  });

  // Respond to proposal mutation
  const respondMutation = useMutation({
    mutationFn: ({ proposalId, response }: { proposalId: string; response: any }) =>
      settlementService.respondToProposal(proposalId, response),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlement-proposals', caseId] });
      toast.success('Response submitted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to submit response');
    },
  });

  const proposals = proposalsResponse?.data || [];
  const session = sessionResponse?.data;
  const analytics = analyticsResponse?.data;
  const aiSuggestion = aiSuggestionResponse?.data;

  // Real-time socket
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') || undefined : undefined;
    const socket = getSocket(token || undefined);

  socket.emit('join-case', { caseId, case_id: caseId });

  // Chat messages local state subscription
  const onNewMessage = (msg: any) => {
    // invalidate negotiation session to refresh messages
    queryClient.invalidateQueries({ queryKey: ['negotiation-session', caseId] });
    toast.success(`${msg.sender}: ${msg.text}`);
  };

    const onNegotiationProposal = (payload: any) => {
      // New proposal created in room
      queryClient.invalidateQueries({ queryKey: ['settlement-proposals', caseId] });
      toast.success('New negotiation proposal received');
    };

    const onNegotiationRound = (payload: any) => {
      queryClient.invalidateQueries({ queryKey: ['negotiation-session', caseId] });
      toast('Negotiation progressed to a new round');
    };

    const onCaseUpdated = (payload: any) => {
      queryClient.invalidateQueries({ queryKey: ['settlement-proposals', caseId] });
      queryClient.invalidateQueries({ queryKey: ['negotiation-session', caseId] });
    };

    socket.on('negotiation-proposal', onNegotiationProposal);
    socket.on('negotiation-new-round', onNegotiationRound);
    socket.on('case-updated', onCaseUpdated);
  socket.on('new-message', onNewMessage);

    return () => {
  socket.emit('leave-case', { caseId, case_id: caseId });
      socket.off('negotiation-proposal', onNegotiationProposal);
      socket.off('negotiation-new-round', onNegotiationRound);
      socket.off('case-updated', onCaseUpdated);
      socket.off('new-message', onNewMessage);
    };
  }, [caseId, queryClient]);
  // Use messages from negotiation session
  const messages = session?.messages || [];
  const [messageText, setMessageText] = useState('');

  const sendMessageMutation = useMutation({
    mutationFn: ({ sessionId, text }: { sessionId: string; text: string }) => settlementService.sendMessage(sessionId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['negotiation-session', caseId] });
    },
    onError: (err: any) => {
      toast.error('Failed to send message');
    }
  });

  const sendMessage = () => {
    if (!messageText.trim() || !session?.id) return;
    sendMessageMutation.mutate({ sessionId: session.id, text: messageText.trim() });
    setMessageText('');
  };

  const handleCreateProposal = () => {
    if (!newProposal.amount || !newProposal.terms) {
      toast.error('Please fill in all required fields');
      return;
    }

    createProposalMutation.mutate({
      caseId,
      amount: newProposal.amount!,
      terms: newProposal.terms!,
      conditions: newProposal.conditions,
    });
  };

  const handleRespondToProposal = (proposalId: string, response: 'accept' | 'reject' | 'counter') => {
    respondMutation.mutate({
      proposalId,
      response: { response }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'counter-proposed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Settlement Negotiation</h1>
          <p className="text-muted-foreground">Manage settlement proposals and negotiations</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => getAISuggestion()}
            className="flex items-center gap-2"
          >
            <Lightbulb className="h-4 w-4" />
            AI Suggestion
          </Button>
          <Button
            onClick={() => setShowCreateProposal(true)}
            className="flex items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            New Proposal
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Proposals</p>
                  <p className="text-2xl font-bold">{proposals.length}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Average Amount</p>
                  <p className="text-2xl font-bold">
                    ${proposals.reduce((acc, p) => acc + p.amount, 0) / proposals.length || 0}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">
                    {Math.round((proposals.filter(p => p.status === 'accepted').length / proposals.length) * 100) || 0}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Session</p>
                  <p className="text-2xl font-bold">{session?.status === 'active' ? 'Yes' : 'No'}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="negotiation">Live Negotiation</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="proposals" className="space-y-4">
          {loadingProposals ? (
            <div className="text-center py-8">Loading proposals...</div>
          ) : proposals.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No proposals yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start the negotiation by creating your first settlement proposal.
                </p>
                <Button onClick={() => setShowCreateProposal(true)}>
                  Create First Proposal
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {proposals.map((proposal) => (
                <Card key={proposal.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          ${proposal.amount.toLocaleString()}
                          <Badge className={getStatusColor(proposal.status)}>
                            {proposal.status}
                          </Badge>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Proposed by {proposal.proposedBy} • {new Date(proposal.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {proposal.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRespondToProposal(proposal.id, 'accept')}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRespondToProposal(proposal.id, 'reject')}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRespondToProposal(proposal.id, 'counter')}
                            >
                              Counter
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Terms</Label>
                        <p className="text-sm text-muted-foreground mt-1">{proposal.terms}</p>
                      </div>
                      {proposal.responses && proposal.responses.length > 0 && (
                        <div>
                          <Label className="text-sm font-medium">Responses</Label>
                          <div className="space-y-2 mt-2">
                            {proposal.responses.map((response) => (
                              <div key={response.id} className="border-l-2 border-muted pl-4">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium">{response.respondedBy}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(response.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {response.response === 'counter' && response.counterAmount
                                    ? `Counter: $${response.counterAmount.toLocaleString()}`
                                    : response.response}
                                </p>
                                {response.notes && (
                                  <p className="text-sm text-muted-foreground italic">{response.notes}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="negotiation">
          <Card>
            <CardHeader>
              <CardTitle>Live Negotiation Room</CardTitle>
            </CardHeader>
            <CardContent>
              {session ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Badge className={session.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {session.status}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      {session.participants.length} participants
                    </p>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-4">
                      <div className="h-64 overflow-y-auto border rounded p-3 bg-white">
                        {messages.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No messages yet. Use the chat to communicate with participants.</div>
                        ) : (
                          <div className="space-y-3">
                            {messages.map((m: any) => (
                              <div key={m.id} className="p-2 rounded hover:bg-muted/50">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">{m.senderId || m.sender || 'Participant'}</span>
                                  <span className="text-xs text-muted-foreground">{new Date(m.timestamp || m.createdAt).toLocaleTimeString()}</span>
                                </div>
                                <div className="text-sm text-muted-foreground">{m.message || m.text}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Write a message..." />
                        <Button onClick={sendMessage} disabled={sendMessageMutation.isPending}>Send</Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Participants</h4>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {session.participants.map((p: any) => (
                          <div key={p} className="flex items-center justify-between">
                            <span>{p}</span>
                            <span className="text-xs text-muted-foreground">online</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No active negotiation session</h3>
                  <p className="text-muted-foreground mb-4">
                    Start a negotiation session to enable real-time collaboration.
                  </p>
                  <Button>Start Negotiation Session</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Settlement Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3">Proposal Performance</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Total Proposals</span>
                          <span className="font-medium">{proposals.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Accepted</span>
                          <span className="font-medium text-green-600">
                            {proposals.filter(p => p.status === 'accepted').length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Rejected</span>
                          <span className="font-medium text-red-600">
                            {proposals.filter(p => p.status === 'rejected').length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pending</span>
                          <span className="font-medium text-yellow-600">
                            {proposals.filter(p => p.status === 'pending').length}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3">Amount Analysis</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Highest Proposal</span>
                          <span className="font-medium">
                            ${Math.max(...proposals.map(p => p.amount)).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lowest Proposal</span>
                          <span className="font-medium">
                            ${Math.min(...proposals.map(p => p.amount)).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Average</span>
                          <span className="font-medium">
                            ${Math.round(proposals.reduce((acc, p) => acc + p.amount, 0) / proposals.length || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No analytics data available yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* AI Suggestion Dialog */}
      {aiSuggestion && (
        <Dialog open={!!aiSuggestion} onOpenChange={() => {}}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                AI Settlement Suggestion
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Recommended Amount</Label>
                <p className="text-2xl font-bold text-green-600">
                  ${aiSuggestion.recommendedAmount?.toLocaleString()}
                </p>
              </div>
              <div>
                <Label>Reasoning</Label>
                <p className="text-sm text-muted-foreground">{aiSuggestion.reasoning}</p>
              </div>
              <div>
                <Label>Success Probability</Label>
                <p className="text-lg font-semibold">{aiSuggestion.successProbability}%</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Proposal Dialog */}
      <Dialog open={showCreateProposal} onOpenChange={setShowCreateProposal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Settlement Proposal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Settlement Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                value={newProposal.amount || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProposal({ ...newProposal, amount: parseInt(e.target.value) })}
                placeholder="Enter amount"
              />
            </div>
            <div>
              <Label htmlFor="terms">Terms & Conditions</Label>
              <Textarea
                id="terms"
                value={newProposal.terms || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewProposal({ ...newProposal, terms: e.target.value })}
                placeholder="Describe the settlement terms..."
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateProposal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateProposal}
                disabled={createProposalMutation.isPending}
              >
                {createProposalMutation.isPending ? 'Creating...' : 'Create Proposal'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}