'use client';

import { useState, useEffect } from 'react';
import { FileText, Users, Gavel, MessageSquare, Clock, CheckCircle, AlertCircle, Send, Scale } from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: 'case_filed' | 'evidence_uploaded' | 'ai_analysis' | 'negotiation_started' | 'proposal_made' | 'settlement_reached' | 'court_filing' | 'party_joined' | 'message_sent';
  title: string;
  description: string;
  actor: string;
  timestamp: string;
  metadata?: any;
}

interface CaseTimelineProps {
  caseId: string;
}

export default function CaseTimeline({ caseId }: CaseTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchTimeline();
  }, [caseId, filter]);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = filter === 'all' 
        ? `${process.env.NEXT_PUBLIC_API_URL}/cases/${caseId}/timeline`
        : `${process.env.NEXT_PUBLIC_API_URL}/cases/${caseId}/timeline?type=${filter}`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setEvents(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'case_filed':
        return <FileText className="w-5 h-5" />;
      case 'evidence_uploaded':
        return <FileText className="w-5 h-5" />;
      case 'ai_analysis':
        return <Scale className="w-5 h-5" />;
      case 'negotiation_started':
        return <MessageSquare className="w-5 h-5" />;
      case 'proposal_made':
        return <Send className="w-5 h-5" />;
      case 'settlement_reached':
        return <CheckCircle className="w-5 h-5" />;
      case 'court_filing':
        return <Gavel className="w-5 h-5" />;
      case 'party_joined':
        return <Users className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'case_filed':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'evidence_uploaded':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'ai_analysis':
        return 'bg-indigo-100 text-indigo-700 border-indigo-300';
      case 'negotiation_started':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'proposal_made':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'settlement_reached':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'court_filing':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'party_joined':
        return 'bg-cyan-100 text-cyan-700 border-cyan-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Case Timeline</h2>
        
        {/* Filter */}
        <div className="flex flex-wrap gap-2">
          {['all', 'case_filed', 'evidence_uploaded', 'ai_analysis', 'negotiation_started', 'settlement_reached', 'court_filing'].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No events yet</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

            {/* Events */}
            <div className="space-y-6">
              {events.map((event, index) => (
                <div key={event.id} className="relative flex items-start space-x-4">
                  {/* Icon */}
                  <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 ${getEventColor(event.type)}`}>
                    {getEventIcon(event.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="text-base font-semibold text-gray-900">{event.title}</h3>
                      <span className="text-sm text-gray-500 whitespace-nowrap ml-4">
                        {formatDate(event.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                    <p className="text-xs text-gray-500">By {event.actor}</p>

                    {/* Metadata */}
                    {event.metadata && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
                        {event.metadata.amount && (
                          <p className="text-gray-700">
                            <span className="font-medium">Amount:</span> ${event.metadata.amount.toLocaleString()}
                          </p>
                        )}
                        {event.metadata.status && (
                          <p className="text-gray-700">
                            <span className="font-medium">Status:</span> {event.metadata.status}
                          </p>
                        )}
                        {event.metadata.details && (
                          <p className="text-gray-700">{event.metadata.details}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
