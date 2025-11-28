import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Users,
  DollarSign,
  FileText,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { aiIntegrationService, AIAnalysisResult } from '@/services/aiIntegrationService';

interface AIAnalysisDisplayProps {
  caseId: string;
  onAnalysisComplete?: (analysis: AIAnalysisResult['analysis']) => void;
  onRequestSettlementOptions?: () => void;
  className?: string;
}

export const AIAnalysisDisplay: React.FC<AIAnalysisDisplayProps> = ({
  caseId,
  onAnalysisComplete,
  onRequestSettlementOptions,
  className = ''
}) => {
  const [analysis, setAnalysis] = useState<AIAnalysisResult['analysis'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [cached, setCached] = useState(false);

  const loadAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await aiIntegrationService.analyzeCase(caseId);
      
      if (response.success) {
        setAnalysis(response.data.analysis);
        setProcessingTime(response.data.processingTime);
        setCached(response.data.cached);
        onAnalysisComplete?.(response.data.analysis);
      } else {
        setError(response.message || 'Failed to analyze case');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      loadAnalysis();
    }
  }, [caseId]);

  const handleRefresh = () => {
    loadAnalysis();
  };

  const handleGenerateOptions = () => {
    onRequestSettlementOptions?.();
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>AI Case Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-lg">Analyzing case...</span>
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
            <Brain className="h-5 w-5" />
            <span>AI Case Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button 
            onClick={handleRefresh} 
            className="mt-4"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>AI Case Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 mb-4">No analysis available for this case.</p>
          <Button onClick={loadAnalysis}>
            Start Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { riskAssessment } = analysis;

  return (
    <div className={className}>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5" />
              <span>AI Case Analysis</span>
              {cached && (
                <Badge variant="secondary" className="ml-2">
                  <Clock className="h-3 w-3 mr-1" />
                  Cached
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">
                {aiIntegrationService.formatProcessingTime(processingTime)}
              </span>
              <Button onClick={handleRefresh} size="sm" variant="ghost">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Executive Summary */}
            <div>
              <h3 className="font-medium mb-2">Executive Summary</h3>
              <p className="text-gray-700 bg-gray-50 p-3 rounded">{analysis.summary}</p>
            </div>

            {/* Win Probability Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-green-700">Complainer Win Probability</span>
                    <span className="text-lg font-bold text-green-700">
                      {aiIntegrationService.formatPercentage(riskAssessment.complainerWinProbability)}
                    </span>
                  </div>
                  <Progress 
                    value={riskAssessment.complainerWinProbability * 100} 
                    className="h-2 bg-green-100"
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-blue-700">Defender Win Probability</span>
                    <span className="text-lg font-bold text-blue-700">
                      {aiIntegrationService.formatPercentage(riskAssessment.defenderWinProbability)}
                    </span>
                  </div>
                  <Progress 
                    value={riskAssessment.defenderWinProbability * 100} 
                    className="h-2 bg-blue-100"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Likely Outcome & Damages */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Likely Outcome
                  </h4>
                  <p className="text-sm text-gray-600">{riskAssessment.likelyOutcome}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2 flex items-center">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Potential Damages
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Minimum:</span>
                      <span>{aiIntegrationService.formatCurrency(riskAssessment.potentialDamages.minimum)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Maximum:</span>
                      <span>{aiIntegrationService.formatCurrency(riskAssessment.potentialDamages.maximum)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Most Likely:</span>
                      <span>{aiIntegrationService.formatCurrency(riskAssessment.potentialDamages.mostLikely)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analysis Tabs */}
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="issues" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="issues">Key Issues</TabsTrigger>
              <TabsTrigger value="strengths">Strengths</TabsTrigger>
              <TabsTrigger value="weaknesses">Weaknesses</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            </TabsList>

            <TabsContent value="issues" className="mt-4">
              <div className="space-y-2">
                <h3 className="font-medium flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Key Issues Identified
                </h3>
                <ul className="space-y-2">
                  {analysis.keyIssues.map((issue, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="strengths" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-green-700 mb-3 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Complainer Strengths
                  </h4>
                  <ul className="space-y-2">
                    {analysis.strengths.complainer.map((strength, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-blue-700 mb-3 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Defender Strengths
                  </h4>
                  <ul className="space-y-2">
                    {analysis.strengths.defender.map((strength, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="weaknesses" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-red-700 mb-3 flex items-center">
                    <TrendingDown className="h-4 w-4 mr-2" />
                    Complainer Weaknesses
                  </h4>
                  <ul className="space-y-2">
                    {analysis.weaknesses.complainer.map((weakness, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-red-700 mb-3 flex items-center">
                    <TrendingDown className="h-4 w-4 mr-2" />
                    Defender Weaknesses
                  </h4>
                  <ul className="space-y-2">
                    {analysis.weaknesses.defender.map((weakness, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="recommendations" className="mt-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-green-700 mb-2">For Complainer</h4>
                  <p className="text-sm text-gray-700 bg-green-50 p-3 rounded">
                    {analysis.recommendations.forComplainer}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-blue-700 mb-2">For Defender</h4>
                  <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded">
                    {analysis.recommendations.forDefender}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-purple-700 mb-2">For Both Parties</h4>
                  <p className="text-sm text-gray-700 bg-purple-50 p-3 rounded">
                    {analysis.recommendations.forBothParties}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Action Button */}
          <div className="mt-6 pt-4 border-t">
            <Button 
              onClick={handleGenerateOptions} 
              className="w-full"
              size="lg"
            >
              <Users className="h-4 w-4 mr-2" />
              Generate Settlement Options
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};