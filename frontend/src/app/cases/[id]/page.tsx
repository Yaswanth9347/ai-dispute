'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function CaseDetailsPage() {
  const params = useParams();
  const caseId = params.id as string;
  const [user, setUser] = useState<any>(null);
  const [caseData, setCaseData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    // Check for demo user data
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }

    // Load demo case data
    loadDemoCase();
    setIsLoading(false);
  }, [caseId]);

  const loadDemoCase = () => {
    // Demo case data with complete AI workflow
    const demoCase = {
      id: caseId,
      caseNumber: 'ADR-2024-001',
      title: 'Property Boundary Dispute',
      description: 'Dispute regarding property boundary with neighbor over 2-foot encroachment',
      category: 'property_dispute',
      status: 'settlement_options_available',
      disputeAmount: '₹5,00,000',
      plaintiff: {
        id: 'user-1',
        name: 'Demo User',
        email: 'demo@aidispute.com'
      },
      defendants: [{
        id: 'def-1',
        name: 'John Smith',
        email: 'john.smith@example.com',
        status: 'responded'
      }],
      createdAt: '2024-10-01',
      lastUpdated: '2024-10-15',
      workflow: {
        currentStep: 4,
        steps: [
          { id: 1, name: 'Case Filed', status: 'completed', date: '2024-10-01' },
          { id: 2, name: 'Invitations Sent', status: 'completed', date: '2024-10-01' },
          { id: 3, name: 'Statements Collected', status: 'completed', date: '2024-10-08' },
          { id: 4, name: 'AI Analysis Complete', status: 'completed', date: '2024-10-12' },
          { id: 5, name: 'Settlement Options', status: 'active', date: '2024-10-15' },
          { id: 6, name: 'Decision Collection', status: 'pending', date: null },
          { id: 7, name: 'Document Generation', status: 'pending', date: null },
          { id: 8, name: 'Digital Signatures', status: 'pending', date: null }
        ]
      },
      statements: [
        {
          id: 'stmt-1',
          user: 'Demo User (Plaintiff)',
          type: 'initial',
          content: 'My neighbor has constructed a boundary wall that encroaches 2 feet into my property. I have the original survey documents and recent measurements to prove this. I am seeking removal of the encroachment and compensation for my loss.',
          submittedAt: '2024-10-01',
          wordCount: 245
        },
        {
          id: 'stmt-2',
          user: 'John Smith (Defendant)',
          type: 'response',
          content: 'I constructed the wall based on the survey I commissioned in 2020. The plaintiff\'s claim is incorrect as per my survey documents. I am willing to get a joint survey done by a government surveyor to resolve this matter.',
          submittedAt: '2024-10-08',
          wordCount: 186
        }
      ],
      evidence: [
        {
          id: 'ev-1',
          type: 'document',
          name: 'Original Property Survey 2018.pdf',
          uploadedBy: 'Demo User',
          relevanceScore: 95,
          status: 'verified'
        },
        {
          id: 'ev-2',
          type: 'image',
          name: 'Boundary Wall Photos.jpg',
          uploadedBy: 'Demo User',
          relevanceScore: 88,
          status: 'verified'
        },
        {
          id: 'ev-3',
          type: 'document',
          name: 'My Survey Report 2020.pdf',
          uploadedBy: 'John Smith',
          relevanceScore: 92,
          status: 'verified'
        }
      ],
      aiAnalysis: {
        confidence: 87,
        completedAt: '2024-10-12',
        summary: 'Based on the analysis of both statements and evidence, there appears to be a genuine boundary dispute arising from conflicting survey reports. The plaintiff\'s 2018 survey and the defendant\'s 2020 survey show different boundary lines.',
        strengthAssessment: {
          plaintiffStrength: 75,
          defendantStrength: 65,
          winProbability: 72
        },
        keyFindings: [
          '2-foot encroachment clearly visible in photographic evidence',
          'Original 2018 survey supports plaintiff\'s position',
          'Defendant shows willingness to resolve through joint survey',
          'No malicious intent apparent from defendant\'s response'
        ],
        legalReferences: [
          {
            act: 'Indian Easements Act, 1882',
            section: 'Section 15',
            description: 'Right to lateral support from adjoining property',
            relevance: 'High'
          },
          {
            act: 'Transfer of Property Act, 1882',
            section: 'Section 53A',
            description: 'Rights of person in possession',
            relevance: 'Medium'
          }
        ],
        precedents: [
          {
            case: 'Ram Kumar vs. Shyam Singh',
            court: 'Delhi High Court',
            year: 2019,
            relevance: 94,
            summary: 'Boundary dispute resolved through joint survey and compensation'
          },
          {
            case: 'Property Owners Association vs. Municipal Corporation',
            court: 'Supreme Court',
            year: 2021,
            relevance: 78,
            summary: 'Established precedent for survey-based boundary resolution'
          }
        ]
      },
      settlementOptions: [
        {
          id: 'option-1',
          rank: 1,
          title: 'Joint Survey & Boundary Correction',
          description: 'Commission a joint government survey to determine exact boundary and rectify the encroachment',
          monetaryAmount: '₹1,50,000',
          timeframe: '45 days',
          probability: 85,
          legalBasis: 'Mutual agreement under Section 89 of CPC',
          terms: [
            'Joint government survey to be commissioned within 15 days',
            'Defendant to bear survey costs (₹25,000)',
            'If encroachment confirmed, defendant removes structure within 30 days',
            'Defendant pays ₹1,50,000 compensation for loss of use',
            'Both parties bear own legal costs'
          ],
          pros: [
            'Definitive resolution based on official survey',
            'Maintains neighborly relations',
            'Avoids lengthy court proceedings',
            'Fair compensation for plaintiff'
          ],
          cons: [
            'Higher cost for defendant',
            'Time required for survey completion',
            'Dependent on government surveyor availability'
          ],
          plaintiffChoice: 'pending',
          defendantChoice: 'pending'
        },
        {
          id: 'option-2',
          rank: 2,
          title: 'Compromise Settlement',
          description: 'Split the disputed area and provide partial compensation',
          monetaryAmount: '₹75,000',
          timeframe: '30 days',
          probability: 70,
          legalBasis: 'Compromise under Section 89 of CPC',
          terms: [
            'Disputed 2-foot area to be split equally (1 foot each)',
            'Defendant adjusts boundary wall accordingly',
            'Defendant pays ₹75,000 as goodwill compensation',
            'Both parties execute mutual release deed',
            'Legal costs shared equally'
          ],
          pros: [
            'Quick resolution',
            'Both parties get partial satisfaction',
            'Lower cost for defendant',
            'Preserves neighborly relations'
          ],
          cons: [
            'Plaintiff loses 1 foot of property',
            'May not fully address legal rights',
            'Compromise may set precedent for future disputes'
          ],
          plaintiffChoice: 'pending',
          defendantChoice: 'pending'
        },
        {
          id: 'option-3',
          rank: 3,
          title: 'Mediated Resolution',
          description: 'Professional mediation with flexible terms based on discussion',
          monetaryAmount: '₹50,000 - ₹2,00,000',
          timeframe: '60 days',
          probability: 60,
          legalBasis: 'Mediation under Section 89 of CPC',
          terms: [
            'Appointment of court-approved mediator',
            'Up to 4 mediation sessions over 60 days',
            'Flexible terms to be decided in mediation',
            'Mediation costs (₹20,000) shared equally',
            'If mediation fails, case proceeds to trial'
          ],
          pros: [
            'Most flexible approach',
            'Allows creative solutions',
            'Professional mediation guidance',
            'Maintains control over outcome'
          ],
          cons: [
            'Uncertain outcome',
            'May not reach agreement',
            'Additional time and cost',
            'Risk of case going to trial'
          ],
          plaintiffChoice: 'pending',
          defendantChoice: 'pending'
        }
      ]
    };

    setCaseData(demoCase);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    window.location.href = '/';
  };

  const handleSettlementChoice = (optionId: string, choice: 'accepted' | 'rejected') => {
    setCaseData((prev: any) => ({
      ...prev,
      settlementOptions: prev.settlementOptions.map((option: any) => 
        option.id === optionId 
          ? { ...option, plaintiffChoice: choice }
          : option
      )
    }));

    // Simulate checking if both parties made choices
    setTimeout(() => {
      alert(`Choice recorded: ${choice}. In the real app, this would check if both parties made their choices and proceed accordingly.`);
    }, 500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading case details...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">Please log in to view case details.</p>
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

  const getStepStatus = (step: any) => {
    if (step.status === 'completed') return 'bg-green-500';
    if (step.status === 'active') return 'bg-blue-500';
    return 'bg-gray-300';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'settlement_options_available': return 'bg-orange-100 text-orange-800';
      case 'ai_analyzing': return 'bg-blue-100 text-blue-800';
      case 'statements_complete': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <a href="/" className="text-2xl font-bold text-gray-900">
                AI Dispute Resolver
              </a>
              <div className="hidden md:flex space-x-6">
                <a href="/dashboard" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </a>
                <a href="/cases" className="text-gray-600 hover:text-gray-900">
                  Cases
                </a>
                <span className="text-blue-600 font-medium">
                  Case Details
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user.name}
              </span>
              <button 
                onClick={handleLogout}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{caseData?.title}</h1>
              <div className="flex items-center space-x-4 mt-2">
                <span className="text-gray-600">Case #{caseData?.caseNumber}</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(caseData?.status)}`}>
                  {formatStatus(caseData?.status)}
                </span>
                <span className="text-gray-600">Amount: {caseData?.disputeAmount}</span>
              </div>
            </div>
            <a
              href="/cases"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Back to Cases
            </a>
          </div>
        </div>

        {/* Workflow Progress */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Case Progress</h2>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              {caseData?.workflow?.steps.map((step: any, index: number) => (
                <div key={step.id} className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getStepStatus(step)}`}>
                    {step.id}
                  </div>
                  <div className="text-xs font-medium text-center mt-2 max-w-20">
                    {step.name}
                  </div>
                  {step.date && (
                    <div className="text-xs text-gray-500 mt-1">
                      {step.date}
                    </div>
                  )}
                  {index < caseData.workflow.steps.length - 1 && (
                    <div className="w-16 h-px bg-gray-300 absolute translate-x-12 -translate-y-6"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {['overview', 'statements', 'evidence', 'ai-analysis', 'settlements'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab === 'ai-analysis' ? 'AI Analysis' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Case Description</h3>
                  <p className="text-gray-600">{caseData?.description}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Parties Involved</h3>
                    <div className="space-y-2">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="font-medium text-blue-900">Plaintiff</div>
                        <div className="text-blue-700">{caseData?.plaintiff.name}</div>
                        <div className="text-blue-600 text-sm">{caseData?.plaintiff.email}</div>
                      </div>
                      {caseData?.defendants.map((defendant: any) => (
                        <div key={defendant.id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="font-medium text-gray-900">Defendant</div>
                          <div className="text-gray-700">{defendant.name}</div>
                          <div className="text-gray-600 text-sm">{defendant.email}</div>
                          <div className="text-green-600 text-sm font-medium">✓ Responded</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Case Timeline</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Filed:</span>
                        <span className="font-medium">{caseData?.createdAt}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Updated:</span>
                        <span className="font-medium">{caseData?.lastUpdated}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Category:</span>
                        <span className="font-medium capitalize">{caseData?.category.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'statements' && (
              <div className="space-y-6">
                <h3 className="font-semibold text-gray-900">Party Statements</h3>
                {caseData?.statements.map((statement: any) => (
                  <div key={statement.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-medium text-gray-900">{statement.user}</div>
                      <div className="text-sm text-gray-500">
                        {statement.submittedAt} • {statement.wordCount} words
                      </div>
                    </div>
                    <div className="text-gray-600 leading-relaxed">
                      {statement.content}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'evidence' && (
              <div className="space-y-6">
                <h3 className="font-semibold text-gray-900">Evidence & Documents</h3>
                <div className="grid grid-cols-1 gap-4">
                  {caseData?.evidence.map((evidence: any) => (
                    <div key={evidence.id} className="border rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          {evidence.type === 'document' ? '📄' : '📷'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{evidence.name}</div>
                          <div className="text-sm text-gray-500">
                            Uploaded by {evidence.uploadedBy} • Relevance: {evidence.relevanceScore}%
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600 text-sm font-medium">✓ {evidence.status}</span>
                        <button className="px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50">
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'ai-analysis' && caseData?.aiAnalysis && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 text-lg">AI Analysis Report</h3>
                    <div className="flex items-center space-x-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        caseData.aiAnalysis.confidence >= 80 ? 'bg-green-100 text-green-800' :
                        caseData.aiAnalysis.confidence >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {caseData.aiAnalysis.confidence}% Confidence
                      </span>
                      <span className="text-sm text-gray-600">
                        Completed: {caseData.aiAnalysis.completedAt}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-gray-700 leading-relaxed mb-6">
                    {caseData.aiAnalysis.summary}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg border">
                      <div className="text-sm font-medium text-gray-600">Plaintiff Strength</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {caseData.aiAnalysis.strengthAssessment.plaintiffStrength}%
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border">
                      <div className="text-sm font-medium text-gray-600">Defendant Strength</div>
                      <div className="text-2xl font-bold text-orange-600">
                        {caseData.aiAnalysis.strengthAssessment.defendantStrength}%
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border">
                      <div className="text-sm font-medium text-gray-600">Win Probability</div>
                      <div className="text-2xl font-bold text-green-600">
                        {caseData.aiAnalysis.strengthAssessment.winProbability}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Key Findings</h4>
                    <div className="space-y-2">
                      {caseData.aiAnalysis.keyFindings.map((finding: string, index: number) => (
                        <div key={index} className="flex items-start space-x-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                          <div className="text-gray-600">{finding}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Legal References</h4>
                    <div className="space-y-3">
                      {caseData.aiAnalysis.legalReferences.map((ref: any, index: number) => (
                        <div key={index} className="border rounded-lg p-3">
                          <div className="font-medium text-gray-900">{ref.act}</div>
                          <div className="text-sm text-gray-600">{ref.section}</div>
                          <div className="text-sm text-gray-500 mt-1">{ref.description}</div>
                          <div className="text-xs text-blue-600 mt-1">Relevance: {ref.relevance}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Legal Precedents</h4>
                  <div className="space-y-3">
                    {caseData.aiAnalysis.precedents.map((precedent: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-gray-900">{precedent.case}</div>
                          <div className="text-sm text-blue-600 font-medium">{precedent.relevance}% relevant</div>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {precedent.court} • {precedent.year}
                        </div>
                        <div className="text-gray-700">{precedent.summary}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settlements' && (
              <div className="space-y-6">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                  <h3 className="font-semibold text-orange-900 mb-2">Settlement Options Available</h3>
                  <p className="text-orange-800">
                    Our AI has analyzed your case and generated the following settlement options based on Indian civil law and similar case precedents. 
                    Please review each option carefully and make your choice.
                  </p>
                </div>

                <div className="space-y-6">
                  {caseData?.settlementOptions.map((option: any) => (
                    <div key={option.id} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-6 py-4 border-b">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                              option.rank === 1 ? 'bg-yellow-500' :
                              option.rank === 2 ? 'bg-gray-400' :
                              'bg-orange-600'
                            }`}>
                              {option.rank}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{option.title}</h4>
                              <p className="text-sm text-gray-600">{option.description}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-lg text-gray-900">{option.monetaryAmount}</div>
                            <div className="text-sm text-gray-600">{option.timeframe}</div>
                            <div className="text-sm text-blue-600 font-medium">{option.probability}% success rate</div>
                          </div>
                        </div>
                      </div>

                      <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">Settlement Terms</h5>
                            <ul className="text-sm text-gray-600 space-y-1">
                              {option.terms.map((term: string, index: number) => (
                                <li key={index} className="flex items-start space-x-2">
                                  <span className="text-blue-500 mt-1">•</span>
                                  <span>{term}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <div className="mb-4">
                              <h5 className="font-medium text-green-700 mb-2">Advantages</h5>
                              <ul className="text-sm text-green-600 space-y-1">
                                {option.pros.map((pro: string, index: number) => (
                                  <li key={index} className="flex items-start space-x-2">
                                    <span className="text-green-500 mt-1">✓</span>
                                    <span>{pro}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div>
                              <h5 className="font-medium text-red-700 mb-2">Considerations</h5>
                              <ul className="text-sm text-red-600 space-y-1">
                                {option.cons.map((con: string, index: number) => (
                                  <li key={index} className="flex items-start space-x-2">
                                    <span className="text-red-500 mt-1">!</span>
                                    <span>{con}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Legal Basis:</span> {option.legalBasis}
                            </div>
                            <div className="flex space-x-3">
                              <button
                                onClick={() => handleSettlementChoice(option.id, 'rejected')}
                                className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 text-sm"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleSettlementChoice(option.id, 'accepted')}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                              >
                                Accept This Option
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h4 className="font-semibold text-blue-900 mb-2">Next Steps</h4>
                  <div className="text-blue-800 text-sm space-y-1">
                    <p>• Once you make your choice, the defendant will be notified to make their selection</p>
                    <p>• If both parties choose the same option, we'll generate the settlement agreement</p>
                    <p>• If choices differ, our AI will analyze and suggest a compromise solution</p>
                    <p>• If no agreement is reached, the case will be forwarded to the regional court with complete documentation</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}