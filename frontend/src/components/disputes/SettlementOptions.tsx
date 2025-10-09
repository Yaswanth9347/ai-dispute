'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { Scale, Check, AlertTriangle, Brain, Gavel } from 'lucide-react';

interface SettlementOptionsProps {
  caseId: string;
  onSuccess?: () => void;
}

interface SettlementOption {
  id: string;
  rank: number;
  title: string;
  summary: string;
  detailed_rationale: string;
  legal_basis: {
    constitutionalArticles: string[];
    civilLaws: string[];
    precedents?: string[];
  };
  fairness_score: number;
  settlement_amount: number;
  currency: string;
  payment_terms: string;
  non_monetary_terms: string[];
  implications: {
    forComplainant?: string;
    forRespondent?: string;
  };
  conditions: string[];
  timeline: string;
  acceptance_probability: number;
  ai_confidence: number;
}

export default function SettlementOptions({ caseId, onSuccess }: SettlementOptionsProps) {
  const [options, setOptions] = useState<SettlementOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadOptions();
  }, [caseId]);

  const loadOptions = async () => {
    try {
      const data = await apiRequest.get<any>(`/disputes/${caseId}/settlement-options`);
      if (data.success) {
        setOptions(data.data.options || []);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load settlement options');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = async (optionId: string) => {
    if (!confirm('Are you sure you want to select this settlement option? This decision is important for the dispute resolution.')) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await apiRequest.post<any>(`/disputes/${caseId}/select-option`, {
        optionId,
        comments: ''
      });

      if (response.success) {
        setSelectedOption(optionId);
        alert('Option selected successfully! Waiting for the other party to make their selection.');
        onSuccess?.();
      } else {
        throw new Error(response.error || 'Failed to select option');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
        <Brain className="w-12 h-12 text-blue-600 mx-auto mb-3" />
        <h3 className="font-semibold text-blue-900 mb-2">AI Analysis Pending</h3>
        <p className="text-sm text-blue-700">
          Settlement options will appear here after AI analyzes both parties' statements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
            <Scale className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-2">AI-Generated Settlement Options</h2>
            <p className="text-sm text-gray-700">
              Our AI has analyzed both parties' statements and evidence to generate fair settlement options
              based on Indian law and ADR principles. Select the option you prefer.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-900">{error}</p>
        </div>
      )}

      {options.map((option, idx) => (
        <div
          key={option.id}
          className={`bg-white rounded-lg border-2 transition-all ${
            selectedOption === option.id
              ? 'border-green-500 shadow-lg'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                    Option {option.rank}
                  </span>
                  <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                    option.fairness_score >= 85 ? 'bg-green-100 text-green-800' :
                    option.fairness_score >= 70 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-orange-100 text-orange-800'
                  }`}>
                    Fairness: {option.fairness_score}%
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">{option.title}</h3>
                <p className="text-gray-600 mt-1">{option.summary}</p>
              </div>
              {selectedOption === option.id && (
                <div className="ml-4 flex items-center space-x-2 text-green-600">
                  <Check className="w-6 h-6" />
                  <span className="font-semibold">Selected</span>
                </div>
              )}
            </div>

            {/* Settlement Amount */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-1">Settlement Amount</p>
              <p className="text-3xl font-bold text-green-700">
                ₹{option.settlement_amount.toLocaleString('en-IN')}
              </p>
              <p className="text-sm text-gray-600 mt-1">{option.payment_terms}</p>
            </div>

            {/* Rationale */}
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 mb-2">AI Rationale:</h4>
              <p className="text-sm text-gray-700 leading-relaxed">
                {option.detailed_rationale}
              </p>
            </div>

            {/* Legal Basis */}
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                <Gavel className="w-4 h-4 mr-2" />
                Legal Basis
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-blue-700 font-medium mb-1">Constitutional Provisions:</p>
                  <ul className="text-sm text-blue-800 space-y-1">
                    {option.legal_basis.constitutionalArticles.map((article, i) => (
                      <li key={i}>• {article}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-blue-700 font-medium mb-1">Civil Laws:</p>
                  <ul className="text-sm text-blue-800 space-y-1">
                    {option.legal_basis.civilLaws.map((law, i) => (
                      <li key={i}>• {law}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Implications */}
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {option.implications.forComplainant && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="font-medium text-gray-900 mb-2">For Complainant:</h5>
                  <p className="text-sm text-gray-700">{option.implications.forComplainant}</p>
                </div>
              )}
              {option.implications.forRespondent && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="font-medium text-gray-900 mb-2">For Respondent:</h5>
                  <p className="text-sm text-gray-700">{option.implications.forRespondent}</p>
                </div>
              )}
            </div>

            {/* Conditions */}
            {option.conditions && option.conditions.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-gray-900 mb-2">Conditions:</h4>
                <ul className="space-y-1">
                  {option.conditions.map((condition, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>{condition}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Timeline & Probability */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-600">Timeline</p>
                <p className="text-sm font-medium text-gray-900">{option.timeline}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Acceptance Probability</p>
                <p className="text-sm font-medium text-gray-900">{option.acceptance_probability}%</p>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={() => handleSelectOption(option.id)}
              disabled={submitting || selectedOption !== null}
              className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                selectedOption === option.id
                  ? 'bg-green-600 text-white cursor-default'
                  : selectedOption
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {selectedOption === option.id
                ? '✓ Selected'
                : selectedOption
                ? 'Already Selected Another Option'
                : submitting
                ? 'Selecting...'
                : 'Select This Option'
              }
            </button>
          </div>
        </div>
      ))}

      {/* AI Confidence Note */}
      {options.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-900">
            <strong>AI Confidence:</strong> {Math.round((options[0]?.ai_confidence || 0.7) * 100)}%
            - This analysis is based on the submitted statements and evidence, evaluated against Indian legal principles.
          </p>
        </div>
      )}
    </div>
  );
}
