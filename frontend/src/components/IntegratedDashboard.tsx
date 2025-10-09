'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import SettlementNegotiation from '@/components/settlement/SettlementNegotiation';
import CourtIntegration from '@/components/court/CourtIntegration';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import SocketStatus from '@/components/SocketStatus';
import { 
  Scale, 
  Building2, 
  FileText, 
  MessageSquare, 
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

interface IntegratedDashboardProps {
  caseId?: string;
}

export default function IntegratedDashboard({ caseId = 'DEMO-CASE-001' }: IntegratedDashboardProps) {
  const [activeModule, setActiveModule] = useState('overview');

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Scale className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold">AI Dispute Resolver</h1>
                  <p className="text-sm text-muted-foreground">
                    Case ID: {caseId} • Frontend-Backend Integration Demo
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  ✅ Backend Connected
                </Badge>
                <SocketStatus />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-6 py-6">
          <Tabs value={activeModule} onValueChange={setActiveModule} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="settlement" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Settlement Negotiation
              </TabsTrigger>
              <TabsTrigger value="court" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Court Integration
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Settlement Status</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">Active</div>
                    <p className="text-xs text-muted-foreground">
                      3 proposals pending review
                    </p>
                    <div className="mt-4">
                      <Button 
                        size="sm" 
                        onClick={() => setActiveModule('settlement')}
                        className="w-full"
                      >
                        Manage Negotiations
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Court Filing</CardTitle>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">Ready</div>
                    <p className="text-xs text-muted-foreground">
                      5 court systems available
                    </p>
                    <div className="mt-4">
                      <Button 
                        size="sm" 
                        onClick={() => setActiveModule('court')}
                        className="w-full"
                      >
                        File with Court
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">System Health</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">Healthy</div>
                    <p className="text-xs text-muted-foreground">
                      All services operational
                    </p>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs">
                        <span>Backend API</span>
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>Court APIs</span>
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>Real-time</span>
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Integration Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Frontend-Backend Integration Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Phase 1: Settlement Negotiation
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span>Service Connection</span>
                          <Badge variant="outline" className="text-green-700 bg-green-50">Connected</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>API Endpoints</span>
                          <Badge variant="outline" className="text-green-700 bg-green-50">8/8 Active</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Real-time Updates</span>
                          <Badge variant="outline" className="text-green-700 bg-green-50">Enabled</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>UI Components</span>
                          <Badge variant="outline" className="text-green-700 bg-green-50">Complete</Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Phase 2: Court Integration
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span>RealCourtAPIService</span>
                          <Badge variant="outline" className="text-green-700 bg-green-50">Connected</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Court Systems</span>
                          <Badge variant="outline" className="text-green-700 bg-green-50">5 Available</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Filing Interface</span>
                          <Badge variant="outline" className="text-green-700 bg-green-50">Active</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Status Tracking</span>
                          <Badge variant="outline" className="text-green-700 bg-green-50">Real-time</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <h5 className="font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      Next Phase: Complete Integration
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <strong>Phase 3:</strong> Real-time Features
                        <p className="text-muted-foreground">Socket.IO integration, live collaboration</p>
                      </div>
                      <div>
                        <strong>Phase 4:</strong> Document Generation
                        <p className="text-muted-foreground">PDF/DOCX creation, template system</p>
                      </div>
                      <div>
                        <strong>Phase 5:</strong> AI Integration
                        <p className="text-muted-foreground">Gemini AI suggestions, analysis</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-2"
                      onClick={() => setActiveModule('settlement')}
                    >
                      <MessageSquare className="h-4 w-4" />
                      New Settlement Proposal
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-2"
                      onClick={() => setActiveModule('court')}
                    >
                      <Building2 className="h-4 w-4" />
                      File with Court
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-2"
                    >
                      <Users className="h-4 w-4" />
                      Invite Parties
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Generate Document
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settlement Negotiation Tab */}
            <TabsContent value="settlement">
              <SettlementNegotiation caseId={caseId} />
            </TabsContent>

            {/* Court Integration Tab */}
            <TabsContent value="court">
              <CourtIntegration caseId={caseId} />
            </TabsContent>
          </Tabs>
        </main>

        {/* Footer */}
        <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 mt-12">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>
                <p>AI Dispute Resolver - Frontend-Backend Integration Demo</p>
              </div>
              <div className="flex items-center gap-4">
                <span>Backend: ✅ Connected</span>
                <span>Real-time: ✅ Active</span>
                <span>Court APIs: ✅ Healthy</span>
              </div>
            </div>
          </div>
        </footer>

        {/* Toast Notifications */}
        <Toaster 
          position="top-right"
          toastOptions={{
            className: 'bg-background border',
          }}
        />
      </div>
    </QueryClientProvider>
  );
}