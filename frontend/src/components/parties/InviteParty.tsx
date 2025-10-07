'use client';

import { useState } from 'react';
import { UserPlus, Mail, Send, CheckCircle, Clock, XCircle } from 'lucide-react';

interface Party {
  email: string;
  name: string;
  role: 'plaintiff' | 'defendant' | 'mediator' | 'witness';
}

interface InvitePartyProps {
  caseId: string;
  onSuccess?: () => void;
}

export default function InviteParty({ caseId, onSuccess }: InvitePartyProps) {
  const [parties, setParties] = useState<Party[]>([{ email: '', name: '', role: 'defendant' }]);
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<any[]>([]);

  const addParty = () => {
    setParties([...parties, { email: '', name: '', role: 'defendant' }]);
  };

  const removeParty = (index: number) => {
    setParties(parties.filter((_, i) => i !== index));
  };

  const updateParty = (index: number, field: keyof Party, value: string) => {
    const updated = [...parties];
    updated[index] = { ...updated[index], [field]: value };
    setParties(updated);
  };

  const handleInvite = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/cases/${caseId}/invite`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ parties }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setInvitations(data.data || []);
        setParties([{ email: '', name: '', role: 'defendant' }]);
        onSuccess?.();
      }
    } catch (error) {
      console.error('Error sending invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { value: 'plaintiff', label: 'Plaintiff', desc: 'Filing the dispute' },
    { value: 'defendant', label: 'Defendant', desc: 'Responding to dispute' },
    { value: 'mediator', label: 'Mediator', desc: 'Neutral third party' },
    { value: 'witness', label: 'Witness', desc: 'Providing testimony' },
  ];

  return (
    <div className="space-y-6">
      {/* Invite Form */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Invite Parties</h2>
            <p className="text-sm text-gray-500">Add parties to this case</p>
          </div>
        </div>

        <div className="space-y-4">
          {parties.map((party, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={party.name}
                    onChange={(e) => updateParty(index, 'name', e.target.value)}
                    placeholder="Full name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={party.email}
                      onChange={(e) => updateParty(index, 'email', e.target.value)}
                      placeholder="email@example.com"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={party.role}
                    onChange={(e) => updateParty(index, 'role', e.target.value as Party['role'])}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {roles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {parties.length > 1 && (
                <button
                  onClick={() => removeParty(index)}
                  className="mt-3 text-sm text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex space-x-3">
          <button
            onClick={addParty}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
          >
            + Add Another Party
          </button>

          <button
            onClick={handleInvite}
            disabled={loading || parties.some((p) => !p.email || !p.name)}
            className="flex-1 flex items-center justify-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <Send className="w-5 h-5" />
            <span>{loading ? 'Sending...' : `Send ${parties.length} Invitation${parties.length > 1 ? 's' : ''}`}</span>
          </button>
        </div>
      </div>

      {/* Invitation Status */}
      {invitations.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Invitations</h3>
          <div className="space-y-3">
            {invitations.map((inv, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-700 font-semibold">{inv.name?.charAt(0) || '?'}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{inv.name}</p>
                    <p className="text-sm text-gray-500">{inv.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {inv.status === 'accepted' ? (
                    <span className="flex items-center text-sm text-green-600">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Accepted
                    </span>
                  ) : inv.status === 'pending' ? (
                    <span className="flex items-center text-sm text-yellow-600">
                      <Clock className="w-4 h-4 mr-1" />
                      Pending
                    </span>
                  ) : (
                    <span className="flex items-center text-sm text-red-600">
                      <XCircle className="w-4 h-4 mr-1" />
                      Declined
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
