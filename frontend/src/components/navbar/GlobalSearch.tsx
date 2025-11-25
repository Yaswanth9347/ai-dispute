'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, FileText, User, Folder } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  id: string;
  type: 'dispute' | 'document' | 'user' | 'message';
  title: string;
  description?: string;
  url: string;
}

interface GlobalSearchProps {
  iconOnly?: boolean;
}

export default function GlobalSearch({ iconOnly = false }: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Keyboard shortcut (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recent_searches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Search function with debounce
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
        
        const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setResults(data.data || data || []);
        } else {
          // Demo results for development
          setResults([
            {
              id: '1',
              type: 'dispute',
              title: `Dispute #${query}`,
              description: 'Property boundary dispute',
              url: `/disputes/${query}`,
            },
            {
              id: '2',
              type: 'document',
              title: `Contract ${query}.pdf`,
              description: 'Uploaded 2 days ago',
              url: `/documents/${query}`,
            },
          ]);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSelectResult = (result: SearchResult) => {
    // Save to recent searches
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recent_searches', JSON.stringify(updated));

    setIsOpen(false);
    setQuery('');
    router.push(result.url);
  };

  const handleRecentSearch = (search: string) => {
    setQuery(search);
    inputRef.current?.focus();
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recent_searches');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'dispute':
        return <FileText className="w-4 h-4" />;
      case 'document':
        return <Folder className="w-4 h-4" />;
      case 'user':
        return <User className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  return (
    <>
      {/* Search Button */}
      {iconOnly ? (
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm text-gray-600 w-64"
        >
          <Search className="w-4 h-4" />
          <span>Search...</span>
          <kbd className="ml-auto px-2 py-0.5 bg-white border rounded text-xs font-mono">⌘K</kbd>
        </button>
      )}

      {/* Search Modal */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search disputes, documents, users..."
                    className="w-full pl-10 pr-10 py-3 border-none focus:outline-none text-lg"
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
                    <p className="text-gray-500 mt-2">Searching...</p>
                  </div>
                ) : query && results.length > 0 ? (
                  <div className="divide-y">
                    {results.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => handleSelectResult(result)}
                        className="w-full px-4 py-3 hover:bg-gray-50 text-left flex items-center gap-3 transition-colors"
                      >
                        <div className="text-gray-400">
                          {getIcon(result.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{result.title}</p>
                          {result.description && (
                            <p className="text-sm text-gray-500 truncate">{result.description}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 uppercase">{result.type}</span>
                      </button>
                    ))}
                  </div>
                ) : query && !isLoading ? (
                  <div className="p-8 text-center">
                    <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No results found for "{query}"</p>
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
                    <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Start typing to search</p>
                    <p className="text-sm text-gray-400 mt-1">Disputes • Documents • Users • Messages</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500 flex items-center justify-between">
                <span>Press ESC to close</span>
                <span>Use ⌘K to open anytime</span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
