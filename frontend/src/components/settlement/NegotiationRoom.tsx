'use client';

import { useState, useEffect } from 'react';
import { useNegotiationSocket } from '@/hooks/useNegotiationSocket';
import { Send, CheckCircle, XCircle, Clock, Users, DollarSign } from 'lucide-react';

interface Proposal {
  id: string;
  amount: number;
  message?: string;
  proposedBy: string;
  proposedAt: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
}

interface NegotiationRoomProps {
  negotiationId: string;
  caseId: string;
  parties: { id: string; name: string; role: string }[];
}

export default function NegotiationRoom({ negotiationId, caseId, parties }: NegotiationRoomProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [negotiationData, setNegotiationData] = useState<any>(null);

  const { isConnected, lastUpdate, sendProposal, acceptProposal, rejectProposal } = useNegotiationSocket({
    negotiationId,
    onUpdate: (data) => {
      // Refresh proposals when update received
      fetchProposals();
    },
  });

  useEffect(() => {
    fetchNegotiation();
    fetchProposals();
  }, [negotiationId]);

  const fetchNegotiation = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/negotiations/active/${negotiationId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setNegotiationData(data.data);
      }
    } catch (error) {
      console.error('Error fetching negotiation:', error);
    }
  };

  const fetchProposals = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/negotiations/active/${negotiationId}/proposals`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setProposals(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching proposals:', error);
    }
  };

  const handleSendProposal = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/negotiations/active/${negotiationId}/propose`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: parseFloat(amount),
            message,
          }),
        }
      );

      if (response.ok) {
        sendProposal(parseFloat(amount), message);
        setAmount('');
        setMessage('');
        await fetchProposals();
      }
    } catch (error) {
      console.error('Error sending proposal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (proposalId: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/negotiations/active/${negotiationId}/respond`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            proposalId,
            action: 'accept',
          }),
        }
      );

      if (response.ok) {
        acceptProposal(proposalId);
        await fetchProposals();
      }
    } catch (error) {
      console.error('Error accepting proposal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (proposalId: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/negotiations/active/${negotiationId}/respond`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            proposalId,
            action: 'reject',
          }),
        }
      );

      if (response.ok) {
        rejectProposal(proposalId);
        await fetchProposals();
      }
    } catch (error) {
      console.error('Error rejecting proposal:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Settlement Negotiation</h2>
          <div className="flex items-center space-x-2">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
              isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-600' : 'bg-red-600'}`} />
              <span className="text-sm font-medium">
                {isConnected ? 'Live' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Parties</p>
              <p className="font-semibold text-gray-900">{parties.length}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <DollarSign className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Proposals</p>
              <p className="font-semibold text-gray-900">{proposals.length}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-semibold text-gray-900">{negotiationData?.status || 'Active'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Parties */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Participating Parties</h3>
        <div className="space-y-2">
          {parties.map((party) => (
            <div key={party.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-700 font-semibold">{party.name.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{party.name}</p>
                  <p className="text-sm text-gray-500 capitalize">{party.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Proposals */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Proposals</h3>
        <div className="space-y-4">
          {proposals.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No proposals yet. Make the first offer!</p>
          ) : (
            proposals.map((proposal) => (
              <div key={proposal.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      <span className="text-2xl font-bold text-gray-900">
                        ${proposal.amount.toLocaleString()}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        proposal.status === 'accepted' ? 'bg-green-100 text-green-700' :
                        proposal.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        proposal.status === 'expired' ? 'bg-gray-100 text-gray-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {proposal.status}
                      </span>
                    </div>
                    {proposal.message && (
                      <p className="text-gray-600 mb-2">{proposal.message}</p>
                    )}
                    <p className="text-sm text-gray-500">
                      Proposed by {proposal.proposedBy} • {new Date(proposal.proposedAt).toLocaleString()}
                    </p>
                  </div>
                  {proposal.status === 'pending' && (
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleAccept(proposal.id)}
                        disabled={loading}
                        className="flex items-center space-x-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleReject(proposal.id)}
                        disabled={loading}
                        className="flex items-center space-x-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* New Proposal Form */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Make a Proposal</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Settlement Amount ($)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a message to explain your proposal..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleSendProposal}
            disabled={loading || !amount || parseFloat(amount) <= 0}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <Send className="w-5 h-5" />
            <span>{loading ? 'Sending...' : 'Send Proposal'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
