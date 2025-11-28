import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Sparkles,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  FileText,
  TrendingUp,
  Scale,
  ArrowRight,
  Handshake,
  Calendar,
  AlertTriangle,
  Target,
  Loader2
} from 'lucide-react';
import { 
  aiIntegrationService, 
  CombinedSolution,
  AIStatus
} from '@/services/aiIntegrationService';

interface CombinedSolutionDisplayProps {
  caseId: string;
  userRole: 'complainer' | 'defender';
  onAcceptSolution?: () => void;
  onRejectSolution?: () => void;
  className?: string;
}

export const CombinedSolutionDisplay: React.FC<CombinedSolutionDisplayProps> = ({
  caseId,
  userRole,
  onAcceptSolution,
  onRejectSolution,
  className = ''
}) => {
  const [solution, setSolution] = useState<CombinedSolution | null>(null);
  const [originalSelections, setOriginalSelections] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userAccepted, setUserAccepted] = useState(false);
  const [otherPartyAccepted, setOtherPartyAccepted] = useState(false);
  const [bothAccepted, setBothAccepted] = useState(false);

  const loadCombinedSolution = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await aiIntegrationService.getAIStatus(caseId);
      
      if (response.success) {
        const aiStatus: AIStatus = response.data;
        
        // Check for combined solution in the analysis
        if (aiStatus.analysis && aiStatus.analysis.combinedSolution) {
          setSolution(aiStatus.analysis.combinedSolution as CombinedSolution);
        }
        
        // Set original selections for comparison
        if (aiStatus.selections) {
          setOriginalSelections(aiStatus.selections);
        }
      } else {
        setError(response.message || 'Failed to load combined solution');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      loadCombinedSolution();
    }
  }, [caseId]);

  const handleAccept = () => {
    setUserAccepted(true);
    onAcceptSolution?.();
  };

  const handleReject = () => {
    onRejectSolution?.();
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Scale className="h-5 w-5" />
            <span>Combined Solution</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-lg">Generating combined solution...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Scale className="h-5 w-5" />
            <span>Combined Solution</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!solution) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Scale className="h-5 w-5" />
            <span>Combined Solution</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Waiting for AI to generate a combined solution based on both parties' preferences...
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {/* Header Card with Acceptance Status */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <span>AI-Generated Combined Solution</span>
            </CardTitle>
            <Badge className="bg-purple-100 text-purple-800">
              {aiIntegrationService.formatPercentage(solution.acceptanceProbability)} acceptance probability
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <Scale className="h-4 w-4" />
            <AlertDescription>
              Since both parties selected different options, our AI has created a balanced solution that incorporates elements from both preferences.
            </AlertDescription>
          </Alert>

          {/* Acceptance Status */}
          {(userAccepted || otherPartyAccepted || bothAccepted) && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-2 flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Acceptance Status
              </h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {userAccepted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-gray-400" />
                  )}
                  <span className="text-sm">You: {userAccepted ? 'Accepted' : 'Pending'}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
                <div className="flex items-center space-x-2">
                  {otherPartyAccepted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-gray-400" />
                  )}
                  <span className="text-sm">Other Party: {otherPartyAccepted ? 'Accepted' : 'Pending'}</span>
                </div>
              </div>
              
              {bothAccepted && (
                <Alert className="mt-3 border-green-200 bg-green-50">
                  <Handshake className="h-4 w-4" />
                  <AlertDescription className="text-green-700">
                    Both parties have accepted the combined solution! The case can now be settled.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Solution Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>{solution.combinedSolution.title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Solution Overview */}
            <div>
              <h3 className="font-medium mb-2">Solution Overview</h3>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                {solution.combinedSolution.description}
              </p>
            </div>

            <Tabs defaultValue="terms" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="terms">Merged Terms</TabsTrigger>
                <TabsTrigger value="compromises">Compromises</TabsTrigger>
                <TabsTrigger value="benefits">Benefits</TabsTrigger>
                <TabsTrigger value="implementation">Implementation</TabsTrigger>
              </TabsList>

              <TabsContent value="terms" className="mt-6 space-y-4">
                {/* Financial Terms */}
                {solution.combinedSolution.mergedTerms.financialAspects && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-3 flex items-center">
                        <DollarSign className="h-4 w-4 mr-2 text-green-600" />
                        Financial Settlement
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(solution.combinedSolution.mergedTerms.financialAspects).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                            <span className="text-sm font-medium">
                              {typeof value === 'number' ? aiIntegrationService.formatCurrency(value) : value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Timeline */}
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3 flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                      Timeline
                    </h4>
                    <p className="text-sm text-gray-700">
                      {solution.combinedSolution.mergedTerms.timeline}
                    </p>
                  </CardContent>
                </Card>

                {/* Conditions */}
                {solution.combinedSolution.mergedTerms.conditions && solution.combinedSolution.mergedTerms.conditions.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-3 flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-purple-600" />
                        Conditions & Terms
                      </h4>
                      <ul className="space-y-2">
                        {solution.combinedSolution.mergedTerms.conditions.map((condition, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-purple-500 mt-1">•</span>
                            <span className="text-sm text-gray-700">{condition}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="compromises" className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-3 text-green-700 flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        Complainer Concessions
                      </h4>
                      <ul className="space-y-2">
                        {solution.combinedSolution.compromises.complainerConcessions.map((concession, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <ArrowRight className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-gray-700">{concession}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-3 text-blue-700 flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        Defender Concessions
                      </h4>
                      <ul className="space-y-2">
                        {solution.combinedSolution.compromises.defenderConcessions.map((concession, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <ArrowRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-gray-700">{concession}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="benefits" className="mt-6">
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3 flex items-center">
                      <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
                      Mutual Benefits
                    </h4>
                    <ul className="space-y-2">
                      {solution.combinedSolution.benefits.map((benefit, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="implementation" className="mt-6 space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3 flex items-center">
                      <Target className="h-4 w-4 mr-2 text-purple-600" />
                      Implementation Steps
                    </h4>
                    <ol className="space-y-2">
                      {solution.combinedSolution.implementation.steps.map((step, index) => (
                        <li key={index} className="flex items-start space-x-3">
                          <span className="flex items-center justify-center w-6 h-6 bg-purple-100 text-purple-600 text-xs font-medium rounded-full flex-shrink-0 mt-0.5">
                            {index + 1}
                          </span>
                          <span className="text-sm text-gray-700">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2 flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-blue-600" />
                        Implementation Timeline
                      </h4>
                      <p className="text-sm text-gray-700">
                        {solution.combinedSolution.implementation.timeline}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2 flex items-center">
                        <Users className="h-4 w-4 mr-2 text-orange-600" />
                        Responsible Parties
                      </h4>
                      <ul className="text-sm text-gray-700 space-y-1">
                        {solution.combinedSolution.implementation.responsibleParties.map((party, index) => (
                          <li key={index}>• {party}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>

            {/* AI Reasoning */}
            <Card className="border-blue-200">
              <CardContent className="p-4">
                <h4 className="font-medium mb-2 flex items-center text-blue-700">
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Reasoning
                </h4>
                <p className="text-sm text-blue-800 bg-blue-50 p-3 rounded">
                  {solution.reasoning}
                </p>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            {!userAccepted && !bothAccepted && (
              <div className="flex space-x-4 pt-6 border-t">
                <Button
                  onClick={handleAccept}
                  className="flex-1"
                  size="lg"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Accept Combined Solution
                </Button>
                <Button
                  onClick={handleReject}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Request Revision
                </Button>
              </div>
            )}

            {userAccepted && !bothAccepted && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="text-green-700">
                  You have accepted the combined solution. Waiting for the other party's response.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};