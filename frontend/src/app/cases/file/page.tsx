'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/fetchClient';

export default function FileCasePage() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    disputeType: '',
    disputeAmount: '',
    otherPartyName: '',
    otherPartyEmail: '',
    description: '',
    evidence: null as File | null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Check for demo user data
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">Please log in to file a case.</p>
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({
      ...prev,
      evidence: file
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await apiFetch('/cases', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.title,
          filed_by: user.id,
          case_type: formData.disputeType,
          jurisdiction: 'Default',
          description: formData.description,
          dispute_amount: formData.disputeAmount,
          other_party_name: formData.otherPartyName,
          other_party_email: formData.otherPartyEmail,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create case');
      }

      const newCase = await response.json();

      // If evidence file exists, upload it
      if (formData.evidence && newCase.id) {
        const formDataWithFile = new FormData();
        formDataWithFile.append('file', formData.evidence);
        formDataWithFile.append('uploader_id', user.id);

        await apiFetch(`/cases/${newCase.id}/evidence`, { method: 'POST', body: formDataWithFile });
      }

      alert('Case filed successfully!');
      window.location.href = '/cases';
    } catch (error: any) {
      console.error('Error filing case:', error);
      alert('Error filing case: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    window.location.href = '/';
  };

  const disputeTypes = [
    'Contract Dispute',
    'Property Dispute',
    'Consumer Complaint',
    'Employment Issue',
    'Neighbor Dispute',
    'Business Dispute',
    'Service Provider Issue',
    'Other'
  ];

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
                  File Case
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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">File New Dispute Case</h1>
          <p className="text-gray-600 mt-2">
            Fill out the form below to start your dispute resolution process
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border">
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* Case Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Case Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Brief description of your dispute"
              />
            </div>

            {/* Dispute Type */}
            <div>
              <label htmlFor="disputeType" className="block text-sm font-medium text-gray-700 mb-2">
                Dispute Type *
              </label>
              <select
                id="disputeType"
                name="disputeType"
                value={formData.disputeType}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select dispute type</option>
                {disputeTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Dispute Amount */}
            <div>
              <label htmlFor="disputeAmount" className="block text-sm font-medium text-gray-700 mb-2">
                Dispute Amount
              </label>
              <input
                type="text"
                id="disputeAmount"
                name="disputeAmount"
                value={formData.disputeAmount}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="$0.00"
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter the monetary value involved in this dispute (if applicable)
              </p>
            </div>

            {/* Other Party Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="otherPartyName" className="block text-sm font-medium text-gray-700 mb-2">
                  Other Party Name *
                </label>
                <input
                  type="text"
                  id="otherPartyName"
                  name="otherPartyName"
                  value={formData.otherPartyName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Name of person/organization"
                />
              </div>
              <div>
                <label htmlFor="otherPartyEmail" className="block text-sm font-medium text-gray-700 mb-2">
                  Other Party Email
                </label>
                <input
                  type="email"
                  id="otherPartyEmail"
                  name="otherPartyEmail"
                  value={formData.otherPartyEmail}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="their@email.com"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Detailed Description *
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Provide a detailed description of your dispute, including relevant dates, circumstances, and what outcome you're seeking..."
              />
            </div>

            {/* Evidence Upload */}
            <div>
              <label htmlFor="evidence" className="block text-sm font-medium text-gray-700 mb-2">
                Upload Evidence
              </label>
              <input
                type="file"
                id="evidence"
                name="evidence"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-1">
                Upload supporting documents (PDF, DOC, images). Maximum file size: 10MB
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <a
                href="/cases"
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </a>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Filing Case...' : 'File Case'}
              </button>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="text-blue-600 text-xl">ℹ️</div>
            <div>
              <h3 className="font-semibold text-blue-800 mb-2">How It Works</h3>
              <ul className="text-blue-700 text-sm space-y-1">
                <li>• After filing, our AI will analyze your case and the evidence</li>
                <li>• The other party will be notified and invited to respond</li>
                <li>• AI will generate settlement recommendations based on similar cases</li>
                <li>• Both parties can negotiate through our secure platform</li>
                <li>• Digital signatures make agreements legally binding</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}