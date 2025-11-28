import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Brain,
  Sparkles,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Scale
} from 'lucide-react';

import { AIAnalysisDisplay } from './AIAnalysisDisplay';
import { SettlementOptionsSelection } from './SettlementOptionsSelection';
import { CombinedSolutionDisplay } from './CombinedSolutionDisplay';
import { aiIntegrationService, AIStatus } from '@/services/aiIntegrationService';

interface AIIntegrationWorkflowProps {
  caseId: string;
  userRole: 'complainer' | 'defender';
  caseStatus: string;
  onStatusChange?: (newStatus: string) => void;
  className?: string;
}

type WorkflowStep = 'analysis' | 'options' | 'selection' | 'combined' | 'settled';

export const AIIntegrationWorkflow: React.FC<AIIntegrationWorkflowProps> = ({
  caseId,
  userRole,
  caseStatus,
  onStatusChange,
  className = ''
}) => {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('analysis');
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAIStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await aiIntegrationService.getAIStatus(caseId);
      
      if (response.success) {
        setAiStatus(response.data);
        determineCurrentStep(response.data);
      } else {
        setError(response.message || 'Failed to load AI status');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const determineCurrentStep = (status: AIStatus) => {
    // Determine the current step based on AI status and case status
    if (status.caseStatus === 'settled') {
      setCurrentStep('settled');
    } else if (status.caseStatus === 'consensus_pending' || 
               (status.selectionStatus?.bothSelected && !status.selectionStatus.sameOption)) {
      setCurrentStep('combined');
    } else if (status.settlementOptions && status.activeOptions) {
      if (status.selectionStatus?.bothSelected && status.selectionStatus.sameOption) {
        setCurrentStep('settled');
      } else {
        setCurrentStep('selection');
      }
    } else if (status.analysis) {
      setCurrentStep('options');
    } else {
      setCurrentStep('analysis');
    }
  };

  useEffect(() => {
    if (caseId) {
      loadAIStatus();
    }
  }, [caseId]);

  const handleAnalysisComplete = () => {
    setCurrentStep('options');
    loadAIStatus();
  };

  const handleSettlementOptionsGenerated = () => {
    setCurrentStep('selection');
    loadAIStatus();
  };

  const handleSelectionMade = () => {
    loadAIStatus(); // Reload to check if both parties have selected
  };

  const handleBothPartiesSelected = (sameOption: boolean) => {
    if (sameOption) {
      setCurrentStep('settled');
      onStatusChange?.('settled');
    } else {
      setCurrentStep('combined');
      onStatusChange?.('consensus_pending');
    }
    loadAIStatus();
  };

  const handleCombinedSolutionAccepted = () => {
    setCurrentStep('settled');
    onStatusChange?.('settled');
  };

  const getStepProgress = (): number => {
    const stepOrder: WorkflowStep[] = ['analysis', 'options', 'selection', 'combined', 'settled'];
    const currentIndex = stepOrder.indexOf(currentStep);
    return ((currentIndex + 1) / stepOrder.length) * 100;
  };

  const getStepStatus = (step: WorkflowStep): 'completed' | 'current' | 'pending' => {
    const stepOrder: WorkflowStep[] = ['analysis', 'options', 'selection', 'combined', 'settled'];
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(step);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-lg">Loading AI workflow...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={loadAIStatus} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {/* Workflow Progress Header */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>AI-Powered Dispute Resolution</span>
          </CardTitle>
          <div className="space-y-4">
            <Progress value={getStepProgress()} className="h-2" />
            
            {/* Step Indicators */}
            <div className="flex justify-between items-center text-xs">
              {[
                { key: 'analysis', label: 'Case Analysis', icon: Brain },
                { key: 'options', label: 'Settlement Options', icon: Sparkles },
                { key: 'selection', label: 'Option Selection', icon: Users },
                { key: 'combined', label: 'Combined Solution', icon: Scale },
                { key: 'settled', label: 'Settlement', icon: CheckCircle2 }
              ].map(({ key, label, icon: Icon }, index) => {
                const status = getStepStatus(key as WorkflowStep);
                return (
                  <div key={key} className="flex flex-col items-center space-y-1">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                      status === 'completed' ? 'bg-green-500 text-white' :
                      status === 'current' ? 'bg-blue-500 text-white' :
                      'bg-gray-200 text-gray-500'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className={`text-center max-w-[80px] ${
                      status === 'current' ? 'text-blue-600 font-medium' :
                      status === 'completed' ? 'text-green-600' :
                      'text-gray-500'
                    }`}>
                      {label}
                    </span>
                    {index < 4 && (
                      <ArrowRight className="absolute translate-x-12 h-3 w-3 text-gray-300" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Current Step Content */}
      <div className="space-y-6">
        {/* Step 1: Case Analysis */}
        {(currentStep === 'analysis' || (aiStatus?.analysis && currentStep !== 'settled')) && (
          <AIAnalysisDisplay
            caseId={caseId}
            onAnalysisComplete={handleAnalysisComplete}
            onRequestSettlementOptions={handleSettlementOptionsGenerated}
          />
        )}

        {/* Step 2: Settlement Options Generation & Selection */}
        {(currentStep === 'options' || currentStep === 'selection') && aiStatus?.analysis && (
          <SettlementOptionsSelection
            caseId={caseId}
            userRole={userRole}
            onSelectionMade={handleSelectionMade}
            onBothPartiesSelected={handleBothPartiesSelected}
          />
        )}

        {/* Step 3: Combined Solution (when parties select different options) */}
        {currentStep === 'combined' && (
          <CombinedSolutionDisplay
            caseId={caseId}
            userRole={userRole}
            onAcceptSolution={handleCombinedSolutionAccepted}
            onRejectSolution={() => {
              // Handle rejection - could generate new options or go back to selection
              setCurrentStep('selection');
            }}
          />
        )}

        {/* Step 4: Settlement Complete */}
        {currentStep === 'settled' && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-800">
                <CheckCircle2 className="h-5 w-5" />
                <span>Case Settled Successfully</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="border-green-300 bg-green-100">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="text-green-800">
                  Congratulations! Your dispute has been successfully resolved through AI-assisted negotiation. 
                  The settlement terms have been finalized and both parties have agreed to the resolution.
                </AlertDescription>
              </Alert>

              <div className="mt-6 p-4 bg-white border border-green-200 rounded-lg">
                <h3 className="font-medium text-green-800 mb-2">What happens next?</h3>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Settlement documents will be generated and sent to both parties</li>
                  <li>• Legal agreements will be prepared for signature</li>
                  <li>• Payment processing (if applicable) will be initiated</li>
                  <li>• Case status will be updated to "Closed - Settled"</li>
                </ul>
              </div>

              {aiStatus?.selections && (
                <div className="mt-4 p-4 bg-white border border-green-200 rounded-lg">
                  <h3 className="font-medium text-green-800 mb-2">Settlement Summary</h3>
                  <div className="text-sm text-green-700">
                    <p>
                      <strong>Settlement Method:</strong> AI-Assisted Resolution
                    </p>
                    <p>
                      <strong>Agreement Type:</strong> {
                        aiStatus.selectionStatus?.sameOption ? 'Mutual Option Selection' : 'Combined Solution'
                      }
                    </p>
                    <p>
                      <strong>Settlement Date:</strong> {new Date().toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Status Information Panel */}
        {aiStatus && currentStep !== 'settled' && (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-800 text-lg">Current Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Analysis Status */}
                <div className="flex items-center justify-between">
                  <span className="text-blue-700">Case Analysis</span>
                  {aiStatus.analysis ? (
                    <Badge className="bg-green-100 text-green-800">Complete</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-600">Pending</Badge>
                  )}
                </div>

                {/* Settlement Options Status */}
                <div className="flex items-center justify-between">
                  <span className="text-blue-700">Settlement Options</span>
                  {aiStatus.settlementOptions ? (
                    <Badge className="bg-green-100 text-green-800">Generated</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-600">Pending</Badge>
                  )}
                </div>

                {/* Selection Status */}
                {aiStatus.activeOptions && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700">Your Selection</span>
                      {aiStatus.selections?.[userRole] ? (
                        <Badge className="bg-green-100 text-green-800">Complete</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700">Other Party Selection</span>
                      {aiStatus.selections?.[userRole === 'complainer' ? 'defender' : 'complainer'] ? (
                        <Badge className="bg-green-100 text-green-800">Complete</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800">Waiting</Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};