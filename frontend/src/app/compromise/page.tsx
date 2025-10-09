'use client';

import { useState, useEffect } from 'react';

export default function CompromisePage() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [compromiseData, setCompromiseData] = useState<any>(null);
  const [userChoice, setUserChoice] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Check for demo user data
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }

    // Load demo compromise scenario
    loadCompromiseScenario();
    setIsLoading(false);
  }, []);

  const loadCompromiseScenario = () => {
    const demoCompromise = {
      caseId: 'ADR-2024-001',
      caseTitle: 'Property Boundary Dispute',
      scenario: 'different_choices',
      originalChoices: {
        plaintiff: {
          optionId: 'option-1',
          title: 'Joint Survey & Boundary Correction',
          amount: '₹1,50,000',
          choice: 'accepted'
        },
        defendant: {
          optionId: 'option-2',
          title: 'Compromise Settlement',
          amount: '₹75,000',
          choice: 'accepted'
        }
      },
      aiReanalysis: {
        confidence: 92,
        analysisDate: '2024-10-16 03:30 PM',
        newRecommendation: 'Based on the divergent choices, our AI has identified a middle-ground solution that incorporates elements from both preferred options.',
        rationale: 'The plaintiff prefers definitive resolution through official survey, while the defendant prefers lower cost and faster resolution. A hybrid approach can satisfy both parties.',
        riskAssessment: {
          plaintiffSatisfaction: 80,
          defendantSatisfaction: 85,
          legalSoundness: 95,
          executability: 90
        }
      },
      compromiseOptions: [
        {
          id: 'compromise-1',
          title: 'Hybrid Survey & Settlement',
          description: 'Official boundary verification with negotiated compensation and shared costs',
          isRecommended: true,
          details: {
            surveyComponent: 'Government surveyor to verify boundary (cost shared 60-40)',
            compensationComponent: 'If encroachment confirmed: ₹1,00,000 compensation',
            timelineComponent: '30 days for survey + 15 days for rectification',
            costDistribution: 'Survey: ₹15,000 shared (Plaintiff ₹6,000, Defendant ₹9,000)',
            additionalTerms: [
              'Defendant removes encroachment within 15 days of survey confirmation',
              'If survey shows no encroachment, plaintiff pays defendant ₹10,000 for inconvenience',
              'Both parties bear own legal costs',
              'Mutual release and no-further-claims agreement'
            ]
          },
          benefits: {
            forPlaintiff: [
              'Official verification as desired',
              'Reasonable compensation if claim proven',
              'Lower survey cost than original option'
            ],
            forDefendant: [
              'Lower total cost than original plaintiff choice',
              'Fair process with shared responsibility',
              'Protection if claim is unproven'
            ],
            mutual: [
              'Faster resolution than court proceedings',
              'Maintains neighborly relations',
              'Legally binding settlement'
            ]
          },
          legalBasis: 'Compromise under Section 89 CPC combined with survey verification under Registration Act',
          probability: 88
        },
        {
          id: 'compromise-2',
          title: 'Mediated Custom Solution',
          description: 'Professional mediation to create a unique solution addressing both parties\' core concerns',
          isRecommended: false,
          details: {
            mediationProcess: 'Court-appointed mediator with real estate expertise',
            timeline: '45 days mediation period',
            costStructure: 'Mediation fee ₹25,000 (shared equally)',
            flexibleOutcomes: 'Custom terms based on mediation discussions',
            additionalTerms: [
              'Up to 6 mediation sessions',
              'Binding mediation clause if agreement reached',
              'If mediation fails, case proceeds to arbitration',
              'Interim maintenance of status quo'
            ]
          },
          benefits: {
            forPlaintiff: [
              'Custom solution addressing specific concerns',
              'Professional guidance throughout process',
              'Fallback to arbitration if needed'
            ],
            forDefendant: [
              'Flexible negotiation environment',
              'Equal voice in solution design',
              'Controlled cost structure'
            ],
            mutual: [
              'Creative solutions possible',
              'Preserves relationship',
              'Confidential process'
            ]
          },
          legalBasis: 'Mediation under Section 89 CPC with arbitration fallback',
          probability: 65
        },
        {
          id: 'compromise-3',
          title: 'Court Referral with Settlement Incentive',
          description: 'Proceed to court but with pre-agreed settlement terms if case outcome is uncertain',
          isRecommended: false,
          details: {
            courtProcess: 'Regular civil court proceedings with fast-track application',
            settlementTrigger: 'If court indicates case may take >6 months or outcome uncertain',
            preAgreedTerms: 'Fall back to Compromise Option 1 terms',
            timeline: '60-90 days initial court phase',
            additionalTerms: [
              'Both parties commit to good faith litigation',
              'Automatic settlement trigger based on court feedback',
              'Shared litigation costs up to ₹50,000 each',
              'Winner takes all legal costs if judgment given'
            ]
          },
          benefits: {
            forPlaintiff: [
              'Full legal resolution if strong case',
              'Safety net with pre-agreed settlement',
              'Court validation of claim'
            ],
            forDefendant: [
              'Fair trial of the dispute',
              'Protection from excessive damages',
              'Clear resolution one way or another'
            ],
            mutual: [
              'Definitive legal resolution',
              'Fallback prevents endless litigation',
              'Court-sanctioned outcome'
            ]
          },
          legalBasis: 'Regular civil litigation with conditional settlement agreement',
          probability: 45
        }
      ]
    };

    setCompromiseData(demoCompromise);
  };

  const handleChoiceSubmit = () => {
    if (!userChoice) {
      alert('Please select a compromise option before proceeding.');
      return;
    }

    setIsSubmitting(true);

    // Simulate submission
    setTimeout(() => {
      alert(`Choice submitted: ${userChoice}. In the real system, this would notify the other party and proceed based on their response. If both parties accept the same compromise, the settlement document would be generated.`);
      setIsSubmitting(false);
    }, 2000);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    window.location.href = '/';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading compromise analysis...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">Please log in to view compromise options.</p>
          <a 
            href="/auth/login" 
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Global Navbar is provided by layout; page-specific nav removed to avoid duplication */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Compromise Analysis Required</h1>
          <p className="text-gray-600 mt-2">
            Both parties selected different settlement options. Our AI has analyzed the situation and generated compromise solutions.
          </p>
        </div>

        {/* Scenario Overview */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-8">
          <div className="flex items-start space-x-3">
            <div className="text-orange-600 text-2xl">⚖️</div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-orange-900 mb-3">Different Choices Detected</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-lg border border-orange-200">
                  <h3 className="font-medium text-gray-900 mb-2">Your Choice (Plaintiff)</h3>
                  <div className="text-blue-600 font-medium">{compromiseData?.originalChoices.plaintiff.title}</div>
                  <div className="text-gray-600 text-sm">{compromiseData?.originalChoices.plaintiff.amount}</div>
                  <div className="text-green-600 text-sm font-medium mt-1">✓ Accepted</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-orange-200">
                  <h3 className="font-medium text-gray-900 mb-2">Defendant's Choice</h3>
                  <div className="text-purple-600 font-medium">{compromiseData?.originalChoices.defendant.title}</div>
                  <div className="text-gray-600 text-sm">{compromiseData?.originalChoices.defendant.amount}</div>
                  <div className="text-green-600 text-sm font-medium mt-1">✓ Accepted</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Re-analysis */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">AI Re-Analysis Results</h2>
              <div className="flex items-center space-x-4">
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  {compromiseData?.aiReanalysis.confidence}% Confidence
                </span>
                <span className="text-sm text-gray-600">
                  {compromiseData?.aiReanalysis.analysisDate}
                </span>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <p className="text-gray-700 leading-relaxed mb-6">
              {compromiseData?.aiReanalysis.newRecommendation}
            </p>
            
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <h3 className="font-medium text-blue-900 mb-2">Analysis Rationale</h3>
              <p className="text-blue-800 text-sm">
                {compromiseData?.aiReanalysis.rationale}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {compromiseData?.aiReanalysis.riskAssessment.plaintiffSatisfaction}%
                </div>
                <div className="text-sm text-gray-600">Plaintiff Satisfaction</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {compromiseData?.aiReanalysis.riskAssessment.defendantSatisfaction}%
                </div>
                <div className="text-sm text-gray-600">Defendant Satisfaction</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {compromiseData?.aiReanalysis.riskAssessment.legalSoundness}%
                </div>
                <div className="text-sm text-gray-600">Legal Soundness</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {compromiseData?.aiReanalysis.riskAssessment.executability}%
                </div>
                <div className="text-sm text-gray-600">Executability</div>
              </div>
            </div>
          </div>
        </div>

        {/* Compromise Options */}
        <div className="space-y-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900">Compromise Settlement Options</h2>
          
          {compromiseData?.compromiseOptions.map((option: any, index: number) => (
            <div key={option.id} className={`border-2 rounded-lg overflow-hidden ${
              option.isRecommended ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
            }`}>
              <div className={`px-6 py-4 border-b ${
                option.isRecommended ? 'bg-green-100 border-green-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id={option.id}
                      name="compromise-choice"
                      value={option.id}
                      checked={userChoice === option.id}
                      onChange={(e) => setUserChoice(e.target.value)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <label htmlFor={option.id} className="font-semibold text-gray-900 cursor-pointer">
                        {option.title}
                      </label>
                      {option.isRecommended && (
                        <span className="ml-3 px-2 py-1 bg-green-600 text-white rounded-full text-xs font-medium">
                          AI Recommended
                        </span>
                      )}
                      <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900">{option.probability}% Success Rate</div>
                    <div className="text-sm text-gray-600">{option.legalBasis}</div>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Details */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Implementation Details</h4>
                    <div className="space-y-3 text-sm">
                      {Object.entries(option.details).map(([key, value]) => (
                        <div key={key}>
                          <span className="font-medium text-gray-700 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                          </span>
                          {Array.isArray(value) ? (
                            <ul className="mt-1 space-y-1">
                              {value.map((item: string, idx: number) => (
                                <li key={idx} className="flex items-start space-x-2">
                                  <span className="text-blue-500 mt-1">•</span>
                                  <span className="text-gray-600">{item}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-gray-600 mt-1">{String(value)}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Benefits */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Benefits Analysis</h4>
                    <div className="space-y-4 text-sm">
                      <div>
                        <h5 className="font-medium text-blue-700 mb-2">For You (Plaintiff):</h5>
                        <ul className="space-y-1">
                          {option.benefits.forPlaintiff.map((benefit: string, idx: number) => (
                            <li key={idx} className="flex items-start space-x-2">
                              <span className="text-blue-500 mt-1">✓</span>
                              <span className="text-blue-600">{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h5 className="font-medium text-purple-700 mb-2">For Defendant:</h5>
                        <ul className="space-y-1">
                          {option.benefits.forDefendant.map((benefit: string, idx: number) => (
                            <li key={idx} className="flex items-start space-x-2">
                              <span className="text-purple-500 mt-1">✓</span>
                              <span className="text-purple-600">{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h5 className="font-medium text-green-700 mb-2">Mutual Benefits:</h5>
                        <ul className="space-y-1">
                          {option.benefits.mutual.map((benefit: string, idx: number) => (
                            <li key={idx} className="flex items-start space-x-2">
                              <span className="text-green-500 mt-1">✓</span>
                              <span className="text-green-600">{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Make Your Compromise Selection</h3>
              <p className="text-gray-600 text-sm mt-1">
                Once you select an option, the defendant will be notified to make their choice from these same options.
              </p>
            </div>
            <div className="flex space-x-4">
              <a
                href="/cases/ADR-2024-001"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Back to Case
              </a>
              <button
                onClick={handleChoiceSubmit}
                disabled={!userChoice || isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Choice'}
              </button>
            </div>
          </div>
        </div>

        {/* Information */}
        <div className="mt-8 p-6 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="text-purple-600 text-xl">🤝</div>
            <div>
              <h3 className="font-semibold text-purple-800 mb-2">Compromise Process</h3>
              <div className="text-purple-700 text-sm space-y-1">
                <p>• If both parties choose the same compromise option → Settlement document generated immediately</p>
                <p>• If parties choose different compromises → Case forwarded to regional court with full documentation</p>
                <p>• The court will have complete AI analysis and all attempted settlement options for informed decision-making</p>
                <p>• All compromise attempts are legally documented and may influence court proceedings</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}