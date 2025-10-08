'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courtService, CourtSystem, FilingData, FilingResponse } from '@/services/courtService';
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
  Building2, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  XCircle,
  PlusCircle,
  RefreshCw,
  BarChart3,
  Activity,
  Upload,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import getSocket from '@/lib/socket';

interface CourtIntegrationProps {
  caseId: string;
}

export default function CourtIntegration({ caseId }: CourtIntegrationProps) {
  const [activeTab, setActiveTab] = useState('filing');
  const [showFilingDialog, setShowFilingDialog] = useState(false);
  const [newFiling, setNewFiling] = useState<Partial<FilingData>>({
    courtSystem: '',
    filingType: '',
    urgency: 'medium',
    documents: []
  });

  const queryClient = useQueryClient();

  // Fetch supported court systems - connects to your RealCourtAPIService.js
  const { data: courtSystemsResponse, isLoading: loadingCourts } = useQuery({
    queryKey: ['court-systems'],
    queryFn: () => courtService.getSupportedCourts(),
  });

  // Fetch service health - connects to your RealCourtAPIService.getServiceHealth()
  const { data: healthResponse, refetch: refetchHealth } = useQuery({
    queryKey: ['court-health'],
    queryFn: () => courtService.getServiceHealth(),
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch court analytics
  const { data: analyticsResponse } = useQuery({
    queryKey: ['court-analytics'],
    queryFn: () => courtService.getAnalytics(),
  });

  // File with court system mutation
  const fileMutation = useMutation({
    mutationFn: (data: FilingData) => courtService.fileWithCourt(data),
    onSuccess: (response) => {
      toast.success(`Filing submitted successfully! Filing ID: ${response.data?.filingId}`);
      setShowFilingDialog(false);
      setNewFiling({
        courtSystem: '',
        filingType: '',
        urgency: 'medium',
        documents: []
      });
      queryClient.invalidateQueries({ queryKey: ['court-analytics'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to submit filing');
    },
  });

  // Refresh all statuses mutation
  const refreshMutation = useMutation({
    mutationFn: () => courtService.refreshAllStatuses(),
    onSuccess: (response) => {
      toast.success(`Refreshed ${response.data?.refreshed} filings, ${response.data?.updated} updated`);
      queryClient.invalidateQueries({ queryKey: ['court-analytics'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to refresh statuses');
    },
  });

  const courtSystems = courtSystemsResponse?.data?.courts || [];
  const health = healthResponse?.data;
  const analytics = analyticsResponse?.data;

  // Socket.IO real-time updates
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') || undefined : undefined;
    const socket = getSocket(token || undefined);

  socket.emit('join-case', { caseId, case_id: caseId });

    const onCaseUpdated = (payload: any) => {
      // payload may include filing updates; refresh analytics
      queryClient.invalidateQueries({ queryKey: ['court-analytics'] });
      toast.success(payload?.message || 'Case updated');
    };

    const onNotification = (payload: any) => {
      toast('🔔 ' + (payload?.title || 'Notification'));
    };

    socket.on('case-updated', onCaseUpdated);
    socket.on('notification', onNotification);

    return () => {
  socket.emit('leave-case', { caseId, case_id: caseId });
      socket.off('case-updated', onCaseUpdated);
      socket.off('notification', onNotification);
    };
  }, [caseId, queryClient]);

  const handleSubmitFiling = () => {
    if (!newFiling.courtSystem || !newFiling.filingType || !newFiling.documents?.length) {
      toast.error('Please fill in all required fields and add at least one document');
      return;
    }

    fileMutation.mutate({
      caseId,
      courtSystem: newFiling.courtSystem!,
      filingType: newFiling.filingType!,
      urgency: newFiling.urgency as 'low' | 'medium' | 'high',
      documents: newFiling.documents!,
      metadata: {
        jurisdiction: 'federal',
        caseNumber: `CASE-${caseId}`,
        partyType: 'plaintiff'
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'degraded': return 'bg-yellow-100 text-yellow-800';
      case 'down': return 'bg-red-100 text-red-800';
      case 'processed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'submitted': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'processed': return <CheckCircle className="h-4 w-4" />;
      case 'degraded':
      case 'processing': return <Clock className="h-4 w-4" />;
      case 'down':
      case 'failed': return <XCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Court Integration</h1>
          <p className="text-muted-foreground">Real court system filing and status tracking</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetchHealth()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Health
          </Button>
          <Button
            variant="outline"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="flex items-center gap-2"
          >
            <Activity className="h-4 w-4" />
            {refreshMutation.isPending ? 'Refreshing...' : 'Refresh All'}
          </Button>
          <Button
            onClick={() => setShowFilingDialog(true)}
            className="flex items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            New Filing
          </Button>
        </div>
      </div>

      {/* Health Status Cards */}
      {health && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overall Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(health.overall)}
                    <span className="text-lg font-semibold capitalize">{health.overall}</span>
                  </div>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Court Systems</p>
                  <p className="text-2xl font-bold">{health.supportedCourtCount}</p>
                </div>
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Healthy Systems</p>
                  <p className="text-2xl font-bold text-green-600">{health.healthyCourtCount}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Connections</p>
                  <p className="text-2xl font-bold">{health.activeConnections}</p>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="filing">Court Filing</TabsTrigger>
          <TabsTrigger value="systems">Court Systems</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
        </TabsList>

        <TabsContent value="filing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Filings</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.recentFilings?.length ? (
                <div className="space-y-4">
                  {analytics.recentFilings.map((filing, index) => (
                    <div key={filing.filingId || index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{filing.filingId}</p>
                          <p className="text-sm text-muted-foreground">
                            {filing.courtSystem} • {new Date(filing.submittedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(filing.status)}>
                          {filing.status}
                        </Badge>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No filings yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Submit your first court filing to get started.
                  </p>
                  <Button onClick={() => setShowFilingDialog(true)}>
                    Create First Filing
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="systems" className="space-y-4">
          {loadingCourts ? (
            <div className="text-center py-8">Loading court systems...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {courtSystems.map((system) => (
                <Card key={system.code}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{system.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{system.code}</p>
                      </div>
                      {health?.services[system.code] && (
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(health.services[system.code].status)}>
                            {health.services[system.code].status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {health.services[system.code].responseTime}ms
                          </span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Filing Types</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {system.filingTypes.map((type) => (
                            <Badge key={type} variant="outline" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Supported Formats</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {system.supportedFormats.map((format) => (
                            <Badge key={format} variant="outline" className="text-xs">
                              {format.toUpperCase()}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Max File Size:</span>
                        <span className="font-medium">
                          {Math.round(system.maxFileSize / (1024 * 1024))}MB
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {analytics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Filing Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Total Filings</span>
                      <span className="text-2xl font-bold">{analytics.totalFilings}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Successful</span>
                      <span className="text-lg font-semibold text-green-600">
                        {analytics.successfulFilings}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Failed</span>
                      <span className="text-lg font-semibold text-red-600">
                        {analytics.failedFilings}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span>Success Rate</span>
                      <span className="text-lg font-semibold">
                        {Math.round((analytics.successfulFilings / analytics.totalFilings) * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Avg Processing Time</span>
                      <span className="text-lg font-semibold">
                        {analytics.averageProcessingTime}min
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Court System Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(analytics.courtSystemBreakdown).map(([system, count]) => (
                      <div key={system} className="flex justify-between items-center">
                        <span className="text-sm font-medium">{system}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full"
                              style={{ 
                                width: `${(count / analytics.totalFilings) * 100}%` 
                              }}
                            />
                          </div>
                          <span className="text-sm font-semibold w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No analytics data</h3>
                <p className="text-muted-foreground">
                  Analytics will appear after you submit your first filing.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          {health ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    System Health Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold mb-1">{health.supportedCourtCount}</div>
                      <div className="text-sm text-muted-foreground">Total Systems</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600 mb-1">{health.healthyCourtCount}</div>
                      <div className="text-sm text-muted-foreground">Healthy</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold mb-1">{health.activeConnections}</div>
                      <div className="text-sm text-muted-foreground">Active Connections</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Individual System Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(health.services).map(([code, service]) => (
                      <div key={code} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          {getStatusIcon(service.status)}
                          <div>
                            <p className="font-medium">{service.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Last checked: {new Date(service.lastCheck).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium">{service.responseTime}ms</p>
                            <p className="text-xs text-muted-foreground">Response Time</p>
                          </div>
                          <Badge className={getStatusColor(service.status)} variant="outline">
                            {service.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Health data unavailable</h3>
                <p className="text-muted-foreground mb-4">
                  Unable to retrieve system health information.
                </p>
                <Button onClick={() => refetchHealth()}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* New Filing Dialog */}
      <Dialog open={showFilingDialog} onOpenChange={setShowFilingDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Submit New Court Filing
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="courtSystem">Court System</Label>
                <select
                  id="courtSystem"
                  className="w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md"
                  value={newFiling.courtSystem || ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                    setNewFiling({ ...newFiling, courtSystem: e.target.value })
                  }
                >
                  <option value="">Select court system</option>
                  {courtSystems.map((system) => (
                    <option key={system.code} value={system.code}>
                      {system.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="filingType">Filing Type</Label>
                <select
                  id="filingType"
                  className="w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md"
                  value={newFiling.filingType || ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                    setNewFiling({ ...newFiling, filingType: e.target.value })
                  }
                >
                  <option value="">Select filing type</option>
                  <option value="civil">Civil</option>
                  <option value="criminal">Criminal</option>
                  <option value="bankruptcy">Bankruptcy</option>
                  <option value="family">Family</option>
                  <option value="probate">Probate</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="urgency">Urgency Level</Label>
              <select
                id="urgency"
                className="w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md"
                value={newFiling.urgency || 'medium'}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                  setNewFiling({ ...newFiling, urgency: e.target.value as 'low' | 'medium' | 'high' })
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <Label>Documents</Label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag & drop files or click to browse
                </p>
                <Button variant="outline" size="sm">
                  Select Files
                </Button>
              </div>
              {newFiling.documents && newFiling.documents.length > 0 && (
                <div className="mt-2 space-y-1">
                  {newFiling.documents.map((doc, index) => (
                    <div key={index} className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {doc.filename}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowFilingDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitFiling}
                disabled={fileMutation.isPending}
              >
                {fileMutation.isPending ? 'Submitting...' : 'Submit Filing'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}