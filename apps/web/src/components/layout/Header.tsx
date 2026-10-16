'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Mail, Clock, Send, AlertCircle } from 'lucide-react';
import { emailsApi } from '@/lib/api';

export function Header() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await emailsApi.search({ q: query, limit: 6 });
        setResults(res.data || []);
        setIsOpen(true);
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <header className="h-16 bg-white border-b border-gray-100 px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Search Input Bar */}
      <div ref={searchRef} className="relative w-full max-w-md">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            id="input-global-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setIsOpen(true);
            }}
            placeholder="Search emails by recipient, subject, or content…"
            className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setResults([]);
                setIsOpen(false);
              }}
              className="absolute right-2.5 p-0.5 rounded text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-modal border border-gray-100 overflow-hidden z-50">
            <div className="p-2 border-b border-gray-50 flex items-center justify-between text-xs text-gray-400">
              <span>{isSearching ? 'Searching via Elasticsearch…' : `${results.length} result(s)`}</span>
              <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">ESC to close</span>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {results.length === 0 && !isSearching ? (
                <div className="p-4 text-center text-sm text-gray-400">
                  No matching emails found
                </div>
              ) : (
                results.map((email: any) => (
                  <div
                    key={email.id}
                    className="p-3 hover:bg-gray-50 transition-colors flex items-start justify-between gap-2"
                  >
                    <div className="overflow-hidden space-y-0.5">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {email.subject}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        To: {email.recipientEmail}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        email.status === 'SENT'
                          ? 'bg-green-50 text-green-700'
                          : email.status === 'FAILED'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-yellow-50 text-yellow-700'
                      }`}
                    >
                      {email.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Top Header Actions */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Scheduler Active</span>
        </div>
      </div>
    </header>
  );
}
