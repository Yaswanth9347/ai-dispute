'use client';

import { useState, useEffect } from 'react';

export default function CaseWorkflowPage() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<string>('case-1');

  useEffect(() => {
    // Check for demo user data
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setIsLoading(false);
  }, []);

  const workflowCases = {
    'case-1': {
      id: 'case-1',
      title: 'Property Boundary Dispute',
      status: 'settlement_options_available',
      workflow: {
        currentStep: 'settlement_decision',
        steps: [
          {
            id: 'filing',
            name: 'Case Filed',
            status: 'completed',
            date: '2024-10-01 10:30 AM',
            description: 'Case filed by plaintiff with initial statement and evidence'
          },
          {
            id: 'invitations',
            name: 'Invitations Sent',
            status: 'completed',
            date: '2024-10-01 11:00 AM',
            description: 'Email invitations sent to all defendants',
            details: {
              invitationsSent: [
                {
                  email: 'john.smith@example.com',
                  name: 'John Smith',
                  sentAt: '2024-10-01 11:00 AM',
                  status: 'responded',
                  respondedAt: '2024-10-03 02:15 PM'
                }
              ]
            }
          },
          {
            id: 'responses',
            name: 'Defendant Responses',
            status: 'completed',
            date: '2024-10-08 05:30 PM',
            description: 'All defendants have submitted their responses',
            details: {
              totalDefendants: 1,
              responsesReceived: 1,
              pendingResponses: 0
            }
          },
          {
            id: 'ai_analysis',
            name: 'AI Analysis',
            status: 'completed',
            date: '2024-10-12 09:45 AM',
            description: 'AI has analyzed all statements and evidence',
            details: {
              analysisTime: '2.5 hours',
              confidence: '87%',
              precedentsFound: 15,
              lawReferencesApplied: 8
            }
          },
          {
            id: 'settlement_decision',
            name: 'Settlement Decision',
            status: 'active',
            date: '2024-10-15 12:00 PM',
            description: 'Parties are reviewing and selecting settlement options',
            details: {
              optionsGenerated: 3,
              plaintiffChoice: 'pending',
              defendantChoice: 'pending',
              deadline: '2024-10-22'
            }
          },
          {
            id: 'document_generation',
            name: 'Document Generation',
            status: 'pending',
            date: null,
            description: 'Generate legal settlement document based on agreed terms'
          },
          {
            id: 'signatures',
            name: 'Digital Signatures',
            status: 'pending',
            date: null,
            description: 'Collect digital signatures from all parties'
          },
          {
            id: 'completion',
            name: 'Case Closed',
            status: 'pending',
            date: null,
            description: 'Case completed and archived for future reference'
          }
        ]
      },
      notifications: [
        {
          id: 'notif-1',
          type: 'system',
          message: 'Settlement options generated and sent to all parties',
          timestamp: '2024-10-15 12:00 PM',
          status: 'delivered'
        },
        {
          id: 'notif-2',
          type: 'email',
          message: 'Email sent to john.smith@example.com: "Settlement Options Available"',
          timestamp: '2024-10-15 12:01 PM',
          status: 'delivered'
        },
        {
          id: 'notif-3',
          type: 'reminder',
          message: 'Reminder: Settlement decision deadline is in 7 days',
          timestamp: '2024-10-15 06:00 PM',
          status: 'scheduled'
        }
      ]
    },
    'case-2': {
      id: 'case-2',
      title: 'Contract Payment Dispute',
      status: 'awaiting_defendant_response',
      workflow: {
        currentStep: 'responses',
        steps: [
          {
            id: 'filing',
            name: 'Case Filed',
            status: 'completed',
            date: '2024-10-05 02:20 PM',
            description: 'Case filed by plaintiff with contract evidence'
          },
          {
            id: 'invitations',
            name: 'Invitations Sent',
            status: 'completed',
            date: '2024-10-05 02:45 PM',
            description: 'Email invitations sent to defendant',
            details: {
              invitationsSent: [
                {
                  email: 'abc.corp@business.com',
                  name: 'ABC Corp Ltd.',
                  sentAt: '2024-10-05 02:45 PM',
                  status: 'pending',
                  remindersSent: 2,
                  lastReminder: '2024-10-12 10:00 AM'
                }
              ]
            }
          },
          {
            id: 'responses',
            name: 'Defendant Responses',
            status: 'active',
            date: null,
            description: 'Waiting for defendant to submit response',
            details: {
              totalDefendants: 1,
              responsesReceived: 0,
              pendingResponses: 1,
              deadline: '2024-10-19'
            }
          }
        ]
      },
      notifications: [
        {
          id: 'notif-4',
          type: 'email',
          message: 'Invitation sent to abc.corp@business.com',
          timestamp: '2024-10-05 02:45 PM',
          status: 'delivered'
        },
        {
          id: 'notif-5',
          type: 'reminder',
          message: 'First reminder sent to defendant',
          timestamp: '2024-10-08 10:00 AM',
          status: 'delivered'
        },
        {
          id: 'notif-6',
          type: 'reminder',
          message: 'Second reminder sent to defendant',
          timestamp: '2024-10-12 10:00 AM',
          status: 'delivered'
        },
        {
          id: 'notif-7',
          type: 'alert',
          message: 'Response deadline approaching (4 days remaining)',
          timestamp: '2024-10-15 09:00 AM',
          status: 'active'
        }
      ]
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    window.location.href = '/';
  };

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'active': return 'bg-blue-500 animate-pulse';
      case 'pending': return 'bg-gray-300';
      default: return 'bg-gray-300';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'email': return '📧';
      case 'system': return '⚙️';
      case 'reminder': return '⏰';
      case 'alert': return '⚠️';
      default: return '📝';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'email': return 'bg-blue-50 border-blue-200';
      case 'system': return 'bg-gray-50 border-gray-200';
      case 'reminder': return 'bg-yellow-50 border-yellow-200';
      case 'alert': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">Please log in to view case workflow.</p>
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

  const currentCase = workflowCases[selectedCase as keyof typeof workflowCases];

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
                  Workflow
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
          <h1 className="text-3xl font-bold text-gray-900">Case Workflow Management</h1>
          <p className="text-gray-600 mt-2">
            Track multi-party dispute resolution process and system notifications
          </p>
        </div>

        {/* Case Selector */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Case to View Workflow:
            </label>
            <select
              value={selectedCase}
              onChange={(e) => setSelectedCase(e.target.value)}
              className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="case-1">Property Boundary Dispute (Advanced Stage)</option>
              <option value="case-2">Contract Payment Dispute (Early Stage)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Workflow Timeline */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {currentCase.title} - Workflow Timeline
                </h2>
              </div>
              
              <div className="p-6">
                <div className="space-y-8">
                  {currentCase.workflow.steps.map((step, index) => (
                    <div key={step.id} className="relative">
                      {/* Connecting Line */}
                      {index < currentCase.workflow.steps.length - 1 && (
                        <div className="absolute left-4 top-10 w-0.5 h-16 bg-gray-300"></div>
                      )}
                      
                      <div className="flex items-start space-x-4">
                        {/* Step Icon */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getStepStatusColor(step.status)}`}>
                          {index + 1}
                        </div>
                        
                        {/* Step Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium text-gray-900">{step.name}</h3>
                            {step.date && (
                              <span className="text-sm text-gray-500">{step.date}</span>
                            )}
                          </div>
                          <p className="text-gray-600 text-sm mt-1">{step.description}</p>
                          
                          {/* Step Details */}
                          {step.details && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                              {step.id === 'invitations' && step.details.invitationsSent && (
                                <div>
                                  <h4 className="font-medium text-gray-900 mb-2">Email Invitations:</h4>
                                  {step.details.invitationsSent.map((invitation: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border">
                                      <div>
                                        <div className="font-medium">{invitation.name}</div>
                                        <div className="text-gray-600">{invitation.email}</div>
                                        <div className="text-xs text-gray-500">Sent: {invitation.sentAt}</div>
                                      </div>
                                      <div className="text-right">
                                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                                          invitation.status === 'responded' ? 'bg-green-100 text-green-800' :
                                          invitation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-gray-100 text-gray-800'
                                        }`}>
                                          {invitation.status}
                                        </div>
                                        {invitation.respondedAt && (
                                          <div className="text-xs text-gray-500 mt-1">
                                            Responded: {invitation.respondedAt}
                                          </div>
                                        )}
                                        {invitation.remindersSent && (
                                          <div className="text-xs text-orange-600 mt-1">
                                            {invitation.remindersSent} reminders sent
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {step.id === 'responses' && (
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <span className="font-medium">Responses Received:</span> {step.details.responsesReceived}/{step.details.totalDefendants}
                                  </div>
                                  <div>
                                    <span className="font-medium">Pending:</span> {step.details.pendingResponses}
                                  </div>
                                  {step.details.deadline && (
                                    <div className="col-span-2">
                                      <span className="font-medium">Deadline:</span> <span className="text-red-600">{step.details.deadline}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {step.id === 'ai_analysis' && step.details && 'analysisTime' in step.details && (
                                <div className="grid grid-cols-2 gap-4">
                                  <div><span className="font-medium">Analysis Time:</span> {(step.details as any).analysisTime}</div>
                                  <div><span className="font-medium">Confidence:</span> {(step.details as any).confidence}</div>
                                  <div><span className="font-medium">Precedents Found:</span> {(step.details as any).precedentsFound}</div>
                                  <div><span className="font-medium">Law References:</span> {(step.details as any).lawReferencesApplied}</div>
                                </div>
                              )}
                              
                              {step.id === 'settlement_decision' && step.details && 'optionsGenerated' in step.details && (
                                <div>
                                  <div className="grid grid-cols-2 gap-4 mb-3">
                                    <div><span className="font-medium">Options Generated:</span> {(step.details as any).optionsGenerated}</div>
                                    <div><span className="font-medium">Decision Deadline:</span> <span className="text-red-600">{(step.details as any).deadline}</span></div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <span className="font-medium">Plaintiff Choice:</span> 
                                      <span className={`ml-2 px-2 py-1 rounded text-xs ${
                                        (step.details as any).plaintiffChoice === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                        (step.details as any).plaintiffChoice === 'accepted' ? 'bg-green-100 text-green-800' :
                                        'bg-red-100 text-red-800'
                                      }`}>
                                        {(step.details as any).plaintiffChoice}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="font-medium">Defendant Choice:</span> 
                                      <span className={`ml-2 px-2 py-1 rounded text-xs ${
                                        (step.details as any).defendantChoice === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                        (step.details as any).defendantChoice === 'accepted' ? 'bg-green-100 text-green-800' :
                                        'bg-red-100 text-red-800'
                                      }`}>
                                        {(step.details as any).defendantChoice}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Notifications Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">System Notifications</h2>
                <p className="text-sm text-gray-600 mt-1">Real-time case updates and alerts</p>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  {currentCase.notifications.map((notification) => (
                    <div key={notification.id} className={`p-4 rounded-lg border ${getNotificationColor(notification.type)}`}>
                      <div className="flex items-start space-x-3">
                        <div className="text-lg">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">{notification.message}</p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-gray-500">{notification.timestamp}</p>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              notification.status === 'delivered' ? 'bg-green-100 text-green-800' :
                              notification.status === 'active' ? 'bg-blue-100 text-blue-800' :
                              notification.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {notification.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border mt-6">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
              </div>
              
              <div className="p-6">
                <div className="space-y-3">
                  <button
                    onClick={() => alert('This would send a reminder email to pending defendants')}
                    className="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900">Send Reminder</div>
                    <div className="text-sm text-gray-600">Remind defendants to respond</div>
                  </button>
                  
                  <button
                    onClick={() => alert('This would generate and download the current case status report')}
                    className="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900">Download Report</div>
                    <div className="text-sm text-gray-600">Generate case progress report</div>
                  </button>
                  
                  <button
                    onClick={() => alert('This would extend the response deadline by 7 days')}
                    className="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900">Extend Deadline</div>
                    <div className="text-sm text-gray-600">Give parties more time</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Demo Notice */}
        <div className="mt-8 p-6 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="text-indigo-600 text-xl">🔄</div>
            <div>
              <h3 className="font-semibold text-indigo-800 mb-2">Multi-Party Workflow Demo</h3>
              <p className="text-indigo-700 text-sm">
                This demonstrates the complete multi-party dispute resolution workflow including email invitations, response tracking, 
                AI analysis phases, settlement option distribution, and decision collection. In the real system, all email notifications 
                would be automatically sent, deadlines enforced, and the workflow would progress based on party responses.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}