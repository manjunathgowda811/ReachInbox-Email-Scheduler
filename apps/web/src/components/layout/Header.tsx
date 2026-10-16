'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Activity, Cpu, Sparkles } from 'lucide-react';
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
    <header className="h-16 bg-[#080C14]/90 backdrop-blur-xl border-b border-white/[0.07] px-8 flex items-center justify-between gap-4 sticky top-0 z-30 selection:bg-brand-500/30">
      {/* Global Search Bar */}
      <div ref={searchRef} className="relative w-full max-w-lg">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            id="input-global-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setIsOpen(true);
            }}
            placeholder="Search email queue, recipients, or subjects..."
            className="w-full pl-10 pr-16 py-2 text-xs bg-dark-900/90 border border-white/[0.08] rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20 transition-all font-sans"
          />
          <div className="absolute right-3 flex items-center gap-1.5">
            {query ? (
              <button
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setIsOpen(false);
                }}
                className="p-0.5 rounded text-gray-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="hidden sm:inline-block text-[10px] font-mono font-medium text-gray-500 bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 rounded">
                /
              </span>
            )}
          </div>
        </div>

        {/* Search Results Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-dark-900 border border-white/[0.1] rounded-2xl shadow-modal overflow-hidden z-50 backdrop-blur-2xl">
            <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between text-xs text-gray-400 bg-dark-950/60 font-mono">
              <span>{isSearching ? 'Querying index...' : `${results.length} record(s) found`}</span>
              <span className="text-[10px] text-gray-500">ESC to dismiss</span>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]">
              {results.length === 0 && !isSearching ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  No matching records in the dispatch index.
                </div>
              ) : (
                results.map((email: any) => (
                  <div
                    key={email.id}
                    className="p-3.5 hover:bg-white/[0.03] transition-colors flex items-start justify-between gap-3 group"
                  >
                    <div className="overflow-hidden space-y-1">
                      <p className="text-xs font-semibold text-gray-200 group-hover:text-white truncate">
                        {email.subject}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate font-mono">
                        To: {email.recipientEmail}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded-full border ${
                        email.status === 'SENT'
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : email.status === 'FAILED'
                          ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
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

      {/* Right Side Telemetry Badges */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 text-xs text-gray-300 bg-dark-900 border border-white/[0.07] px-3 py-1.5 rounded-xl font-mono">
          <Cpu className="w-3.5 h-3.5 text-brand-cyan" />
          <span>BullMQ Redis</span>
          <span className="text-gray-600">•</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            0.04ms
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-300 bg-dark-900 border border-white/[0.07] px-3 py-1.5 rounded-xl">
          <Activity className="w-3.5 h-3.5 text-brand-400" />
          <span className="hidden sm:inline text-xs font-medium">Cluster Health</span>
          <span className="text-xs font-mono font-semibold text-emerald-400">99.99%</span>
        </div>
      </div>
    </header>
  );
}
