import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  Sparkles,
  Clock,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Loader2,
  Users,
  Calendar,
  Scale,
  Shield
} from 'lucide-react';
import { 
  aiIntegrationService, 
  SettlementOption, 
  SettlementOptionsResult,
  OptionSelection
} from '@/services/aiIntegrationService';

interface SettlementOptionsSelectionProps {
  caseId: string;
  userRole: 'complainer' | 'defender';
  onSelectionMade?: (selection: OptionSelection) => void;
  onBothPartiesSelected?: (sameOption: boolean) => void;
  className?: string;
}

export const SettlementOptionsSelection: React.FC<SettlementOptionsSelectionProps> = ({
  caseId,
  userRole,
  onSelectionMade,
  onBothPartiesSelected,
  className = ''
}) => {
  const [options, setOptions] = useState<SettlementOptionsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [reasoning, setReasoning] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasSelected, setHasSelected] = useState(false);
  const [mySelection, setMySelection] = useState<OptionSelection | null>(null);
  const [otherPartySelection, setOtherPartySelection] = useState<OptionSelection | null>(null);
  const [bothSelected, setBothSelected] = useState(false);
  const [sameOption, setSameOption] = useState(false);

  const loadOptions = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await aiIntegrationService.generateSettlementOptions(caseId);
      
      if (response.success) {
        setOptions(response.data.options);
      } else {
        setError(response.message || 'Failed to generate settlement options');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const checkSelectionStatus = async () => {
    try {
      const response = await aiIntegrationService.getAIStatus(caseId);
      
      if (response.success && response.data.selections) {
        const selections = response.data.selections;
        const mySelection = selections[userRole];
        const otherSelection = selections[userRole === 'complainer' ? 'defender' : 'complainer'];
        
        setMySelection(mySelection || null);
        setOtherPartySelection(otherSelection || null);
        setHasSelected(!!mySelection);
        
        if (mySelection) {
          setSelectedOptionId(mySelection.selected_option_id);
          setReasoning(mySelection.selection_reasoning || '');
        }

        if (response.data.selectionStatus) {
          setBothSelected(response.data.selectionStatus.bothSelected);
          setSameOption(response.data.selectionStatus.sameOption);
          
          if (response.data.selectionStatus.bothSelected) {
            onBothPartiesSelected?.(response.data.selectionStatus.sameOption);
          }
        }
      }
    } catch (err) {
      console.error('Error checking selection status:', err);
    }
  };

  useEffect(() => {
    if (caseId) {
      loadOptions();
      checkSelectionStatus();
    }
  }, [caseId]);

  const handleSubmitSelection = async () => {
    if (!selectedOptionId) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await aiIntegrationService.selectOption(
        caseId,
        selectedOptionId,
        reasoning
      );

      if (response.success) {
        setHasSelected(true);
        setMySelection(response.data.selection);
        setBothSelected(response.data.bothSelected);
        setSameOption(response.data.sameOption);
        
        onSelectionMade?.(response.data.selection);
        
        if (response.data.bothSelected) {
          onBothPartiesSelected?.(response.data.sameOption);
        }
      } else {
        setError(response.message || 'Failed to submit selection');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const getRiskBadgeClass = (level: SettlementOption['riskLevel']) => {
    return aiIntegrationService.getRiskLevelColor(level);
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5" />
            <span>Settlement Options</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-lg">Generating settlement options...</span>
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
            <Sparkles className="h-5 w-5" />
            <span>Settlement Options</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!options) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5" />
            <span>Settlement Options</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">No settlement options available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5" />
            <span>AI-Generated Settlement Options</span>
          </CardTitle>
          {options.metadata && (
            <p className="text-sm text-gray-500">
              Generated at {new Date(options.metadata.generatedAt).toLocaleString()}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {/* AI Insights */}
          {options.aiInsights && (
            <Alert className="mb-6">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>AI Recommendation:</strong> {options.aiInsights.reasoning}
              </AlertDescription>
            </Alert>
          )}

          {/* Selection Status */}
          {bothSelected && (
            <Alert className={sameOption ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
              <Users className="h-4 w-4" />
              <AlertDescription>
                {sameOption 
                  ? "Both parties have selected the same option! Settlement can proceed." 
                  : "Both parties have made different selections. AI will generate a combined solution."}
              </AlertDescription>
            </Alert>
          )}

          {hasSelected && !bothSelected && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                You have made your selection. Waiting for the other party to choose their preferred option.
              </AlertDescription>
            </Alert>
          )}

          {/* Options Selection */}
          {!hasSelected && (
            <div className="space-y-6">
              <RadioGroup value={selectedOptionId} onValueChange={setSelectedOptionId}>
                <div className="grid gap-4">
                  {options.options.map((option) => (
                    <Card key={option.id} className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                      selectedOptionId === option.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                    }`}>
                      <CardContent className="p-6">
                        <div className="flex items-start space-x-4">
                          <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                          <Label htmlFor={option.id} className="cursor-pointer flex-1">
                            <div className="space-y-3">
                              {/* Option Header */}
                              <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900">{option.title}</h3>
                                <div className="flex items-center space-x-2">
                                  <Badge className={getRiskBadgeClass(option.riskLevel)}>
                                    {option.riskLevel} risk
                                  </Badge>
                                  <Badge variant="outline">
                                    {aiIntegrationService.formatPercentage(option.acceptanceProbability)} likely
                                  </Badge>
                                </div>
                              </div>

                              {/* Description */}
                              <p className="text-gray-700">{option.description}</p>

                              {/* Terms */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                {option.terms.financialSettlement && (
                                  <div className="flex items-center space-x-2">
                                    <DollarSign className="h-4 w-4 text-green-600" />
                                    <span className="text-sm">
                                      <strong>Settlement:</strong> {aiIntegrationService.formatCurrency(option.terms.financialSettlement)}
                                    </span>
                                  </div>
                                )}
                                
                                <div className="flex items-center space-x-2">
                                  <Calendar className="h-4 w-4 text-blue-600" />
                                  <span className="text-sm">
                                    <strong>Timeline:</strong> {option.terms.timeline}
                                  </span>
                                </div>

                                {option.legalBinding && (
                                  <div className="flex items-center space-x-2">
                                    <Shield className="h-4 w-4 text-purple-600" />
                                    <span className="text-sm">
                                      <strong>Legally Binding:</strong> Yes
                                    </span>
                                  </div>
                                )}

                                {option.terms.paymentSchedule && (
                                  <div className="flex items-center space-x-2">
                                    <Clock className="h-4 w-4 text-orange-600" />
                                    <span className="text-sm">
                                      <strong>Payment:</strong> {option.terms.paymentSchedule}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Pros and Cons */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center">
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    Advantages
                                  </h4>
                                  <ul className="text-xs text-gray-600 space-y-1">
                                    {option.pros.slice(0, 3).map((pro, idx) => (
                                      <li key={idx} className="flex items-start">
                                        <span className="text-green-500 mr-1">•</span>
                                        {pro}
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                <div>
                                  <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center">
                                    <TrendingDown className="h-3 w-3 mr-1" />
                                    Considerations
                                  </h4>
                                  <ul className="text-xs text-gray-600 space-y-1">
                                    {option.cons.slice(0, 3).map((con, idx) => (
                                      <li key={idx} className="flex items-start">
                                        <span className="text-red-500 mr-1">•</span>
                                        {con}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>

                              {/* Non-financial terms */}
                              {option.terms.nonFinancialTerms && option.terms.nonFinancialTerms.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                                    <FileText className="h-3 w-3 mr-1" />
                                    Additional Terms
                                  </h4>
                                  <ul className="text-xs text-gray-600 space-y-1">
                                    {option.terms.nonFinancialTerms.map((term, idx) => (
                                      <li key={idx}>• {term}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </Label>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </RadioGroup>

              {/* Reasoning Input */}
              <div className="space-y-2">
                <Label htmlFor="reasoning">Selection Reasoning (Optional)</Label>
                <Textarea
                  id="reasoning"
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  placeholder="Explain why you prefer this option..."
                  rows={3}
                />
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmitSelection}
                disabled={!selectedOptionId || submitting}
                className="w-full"
                size="lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting Selection...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Submit My Choice
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Show Current Selection */}
          {hasSelected && mySelection && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-medium text-green-800 mb-2">Your Selection</h3>
              <p className="text-sm text-green-700">
                You selected: <strong>
                  {options.options.find(opt => opt.id === mySelection.selected_option_id)?.title}
                </strong>
              </p>
              {mySelection.selection_reasoning && (
                <p className="text-sm text-green-600 mt-1">
                  <em>"{mySelection.selection_reasoning}"</em>
                </p>
              )}
              <p className="text-xs text-green-600 mt-2">
                Selected on {new Date(mySelection.selected_at).toLocaleString()}
              </p>
            </div>
          )}

          {/* Show Other Party Status */}
          {otherPartySelection && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-2">Other Party's Selection</h3>
              <p className="text-sm text-blue-700">
                The other party has made their selection
                {sameOption && mySelection && (
                  <span className="text-green-600 font-medium"> (same as yours!)</span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};