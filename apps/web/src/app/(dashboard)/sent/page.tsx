'use client';

import React, { useState, useEffect } from 'react';
import { emailsApi } from '@/lib/api';
import { Send, RefreshCw, ExternalLink, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function SentEmailsPage() {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadSent = async (p = page) => {
    setLoading(true);
    try {
      const res = await emailsApi.sent({ page: p, limit: 15 });
      setEmails(res.data || []);
      setTotalPages(res.meta?.totalPages || 1);
      setTotalCount(res.meta?.total || 0);
    } catch {
      toast.error('Failed to load sent emails history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSent(page);
  }, [page]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto selection:bg-brand-500/30">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-semibold">
              Delivered Registry
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Sent History & Audit
          </h1>
          <p className="text-xs md:text-sm text-gray-400 mt-1">
            {totalCount} email{totalCount === 1 ? '' : 's'} dispatched through configured SMTP relays with transactional logging.
          </p>
        </div>

        <button
          onClick={() => loadSent(page)}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-300 bg-dark-900 border border-white/[0.08] rounded-xl hover:bg-dark-850 hover:text-white transition-all shadow-card focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-400' : 'text-gray-400'}`} />
          <span>Refresh History</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-dark-900 rounded-2xl border border-white/[0.08] shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-dark-950/60 border-b border-white/[0.07] text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-3.5">Recipient</th>
                <th className="px-6 py-3.5">Campaign Subject</th>
                <th className="px-6 py-3.5">Sender</th>
                <th className="px-6 py-3.5">Dispatched At</th>
                <th className="px-6 py-3.5">Delivery Status</th>
                <th className="px-6 py-3.5 text-right">Ethereal Sandbox</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-gray-400">
                      <Mail className="w-5 h-5 text-emerald-400/80" />
                    </div>
                    <p className="text-sm font-semibold text-gray-300">
                      No sent dispatches recorded yet.
                    </p>
                    <p className="text-xs text-gray-500">
                      Dispatched emails and Ethereal preview links will appear here immediately after delivery.
                    </p>
                  </td>
                </tr>
              ) : (
                emails.map((email: any) => (
                  <tr key={email.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 font-mono font-medium text-gray-100">
                      {email.recipientEmail}
                    </td>
                    <td className="px-6 py-4 text-gray-300 font-sans max-w-xs truncate font-medium">
                      {email.subject}
                    </td>
                    <td className="px-6 py-4 text-gray-400 font-mono text-[11px]">
                      {email.sender?.name || email.sender?.email}
                    </td>
                    <td className="px-6 py-4 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                      {email.sentAt ? format(new Date(email.sentAt), 'MMM d, yyyy HH:mm:ss') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase font-semibold px-2.5 py-0.5 rounded-full border ${
                          email.status === 'SENT'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {email.status === 'SENT' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3 h-3 text-rose-400" />
                        )}
                        <span>{email.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {email.etherealUrl ? (
                        <a
                          href={email.etherealUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-semibold text-brand-300 hover:text-white bg-brand-500/10 hover:bg-brand-500/20 rounded-lg border border-brand-500/25 transition-all"
                        >
                          <span>Inspect Email</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[11px] font-mono text-gray-600">SMTP Direct</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-gray-400 bg-dark-950/40">
            <span className="font-mono text-[11px]">
              Page {page} of {totalPages} ({totalCount} total dispatched)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1 rounded-lg hover:bg-white/[0.06] text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1 rounded-lg hover:bg-white/[0.06] text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
