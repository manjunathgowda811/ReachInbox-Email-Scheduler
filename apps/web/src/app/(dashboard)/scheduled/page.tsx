'use client';

import React, { useState, useEffect } from 'react';
import { emailsApi, schedulesApi } from '@/lib/api';
import { Clock, RefreshCw, XCircle, Search, Layers, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function ScheduledEmailsPage() {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadScheduled = async (p = page) => {
    setLoading(true);
    try {
      const res = await emailsApi.scheduled({ page: p, limit: 15 });
      setEmails(res.data || []);
      setTotalPages(res.meta?.totalPages || 1);
      setTotalCount(res.meta?.total || 0);
    } catch {
      toast.error('Failed to load scheduled queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScheduled(page);
  }, [page]);

  const handleCancel = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to cancel remaining jobs for this campaign?')) return;
    try {
      await schedulesApi.cancel(scheduleId);
      toast.success('Campaign cancelled');
      loadScheduled(page);
    } catch {
      toast.error('Failed to cancel campaign');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto selection:bg-brand-500/30">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-semibold">
              Pending Queue State
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Scheduled Queue
          </h1>
          <p className="text-xs md:text-sm text-gray-400 mt-1">
            {totalCount} job{totalCount === 1 ? '' : 's'} staged in PostgreSQL outbox awaiting release timing.
          </p>
        </div>

        <button
          onClick={() => loadScheduled(page)}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-300 bg-dark-900 border border-white/[0.08] rounded-xl hover:bg-dark-850 hover:text-white transition-all shadow-card focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-400' : 'text-gray-400'}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-dark-900 rounded-2xl border border-white/[0.08] shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-dark-950/60 border-b border-white/[0.07] text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-3.5">Recipient Target</th>
                <th className="px-6 py-3.5">Campaign Subject</th>
                <th className="px-6 py-3.5">Sender Identity</th>
                <th className="px-6 py-3.5">Scheduled Timestamp</th>
                <th className="px-6 py-3.5">Queue Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-gray-400">
                      <Clock className="w-5 h-5 text-amber-400/80" />
                    </div>
                    <p className="text-sm font-semibold text-gray-300">
                      No emails queued in the scheduler.
                    </p>
                    <p className="text-xs text-gray-500">
                      Campaigns with future release times or rate-limited pauses will appear here.
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
                      {email.scheduledAt ? format(new Date(email.scheduledAt), 'MMM d, yyyy HH:mm:ss') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-[10px] font-mono uppercase font-semibold px-2.5 py-0.5 rounded-full border ${
                          email.status === 'RATE_LIMITED'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 animate-pulse'
                            : email.status === 'PROCESSING'
                            ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30 animate-pulse'
                            : 'bg-brand-500/10 text-brand-300 border-brand-500/30'
                        }`}
                      >
                        {email.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {email.scheduleId && (
                        <button
                          onClick={() => handleCancel(email.scheduleId)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg border border-rose-500/20 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
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
              Page {page} of {totalPages} ({totalCount} total queued)
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
