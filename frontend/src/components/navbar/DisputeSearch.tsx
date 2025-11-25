'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, FileText, Filter } from 'lucide-react';

interface DisputeResult {
  id: string;
  case_number?: string;
  title: string;
  description?: string;
  status?: string;
  created_at?: string;
}

export default function DisputeSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DisputeResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dispute_recent_searches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Search disputes only
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
        const token = localStorage.getItem('auth_token');
        
        // Search only in disputes/cases
        const response = await fetch(`${API_URL}/disputes?search=${encodeURIComponent(query)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const disputes = data.data || data || [];
          
          // Filter disputes based on search query
          const filtered = disputes.filter((dispute: any) => {
            const searchStr = query.toLowerCase();
            return (
              dispute.case_number?.toLowerCase().includes(searchStr) ||
              dispute.title?.toLowerCase().includes(searchStr) ||
              dispute.description?.toLowerCase().includes(searchStr) ||
              dispute.status?.toLowerCase().includes(searchStr)
            );
          });
          
          setResults(filtered.slice(0, 10)); // Limit to 10 results
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error('Dispute search failed:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSelectResult = (dispute: DisputeResult) => {
    // Save to recent searches
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('dispute_recent_searches', JSON.stringify(updated));

    setIsOpen(false);
    setQuery('');
    
    // Navigate to dispute detail or apply filter (you can customize this)
    if (dispute.id) {
      window.location.href = `/disputes/${dispute.id}`;
    }
  };

  const handleRecentSearch = (search: string) => {
    setQuery(search);
    inputRef.current?.focus();
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('dispute_recent_searches');
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <>
      {/* Search Icon Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
        aria-label="Search Disputes"
        title="Search Disputes"
      >
        <Search className="w-5 h-5" />
      </button>

      {/* Search Modal */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] pointer-events-none">
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden pointer-events-auto">
              {/* Search Input */}
              <div className="p-4 border-b">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h2 className="text-sm font-semibold text-gray-900">Search Disputes & Cases</h2>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by case number, title, description, status..."
                    className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                    autoFocus
                  />
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Results */}
              <div className="max-h-96 overflow-y-auto">
                {isLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Searching disputes...</p>
                  </div>
                ) : query && results.length > 0 ? (
                  <div className="divide-y">
                    {results.map((dispute) => (
                      <button
                        key={dispute.id}
                        onClick={() => handleSelectResult(dispute)}
                        className="w-full px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-blue-600 mt-1">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {dispute.case_number && (
                                <span className="text-xs font-mono text-gray-500">#{dispute.case_number}</span>
                              )}
                              {dispute.status && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(dispute.status)}`}>
                                  {dispute.status.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-gray-900 truncate">{dispute.title}</p>
                            {dispute.description && (
                              <p className="text-sm text-gray-500 truncate mt-0.5">{dispute.description}</p>
                            )}
                            {dispute.created_at && (
                              <p className="text-xs text-gray-400 mt-1">Created {formatDate(dispute.created_at)}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : query && !isLoading ? (
                  <div className="p-8 text-center">
                    <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No disputes found for "{query}"</p>
                    <p className="text-sm text-gray-400 mt-1">Try searching with different keywords</p>
                  </div>
                ) : recentSearches.length > 0 ? (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900">Recent Searches</h3>
                      <button
                        onClick={clearRecentSearches}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="space-y-1">
                      {recentSearches.map((search, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleRecentSearch(search)}
                          className="w-full px-3 py-2 hover:bg-gray-50 rounded-lg text-left flex items-center gap-2 text-sm text-gray-700"
                        >
                          <Clock className="w-4 h-4 text-gray-400" />
                          {search}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Start typing to search</p>
                    <p className="text-sm text-gray-400 mt-1">Search disputes by case number, title, or status</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500 flex items-center justify-between">
                <span>Press ESC to close</span>
                <span className="text-blue-600">Disputes only</span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
