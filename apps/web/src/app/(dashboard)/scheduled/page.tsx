'use client';

import React, { useState, useEffect } from 'react';
import { emailsApi, schedulesApi } from '@/lib/api';
import { Clock, RefreshCw, XCircle, Search } from 'lucide-react';
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
      toast.error('Failed to load scheduled emails');
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
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Scheduled Emails</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount} email{totalCount === 1 ? '' : 's'} queued for dispatch with persistent state.
          </p>
        </div>
        <button
          onClick={() => loadScheduled(page)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Recipient</th>
                <th className="px-6 py-3">Subject</th>
                <th className="px-6 py-3">Sender</th>
                <th className="px-6 py-3">Scheduled At</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                    No scheduled emails in queue. Click "+ Compose" to schedule a dispatch!
                  </td>
                </tr>
              ) : (
                emails.map((email: any) => (
                  <tr key={email.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{email.recipientEmail}</td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{email.subject}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {email.sender?.name || email.sender?.email}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs whitespace-nowrap">
                      {email.scheduledAt ? format(new Date(email.scheduledAt), 'MMM d, yyyy HH:mm:ss') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          email.status === 'RATE_LIMITED'
                            ? 'bg-amber-50 text-amber-700'
                            : email.status === 'PROCESSING'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {email.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {['PENDING', 'SCHEDULED', 'RATE_LIMITED'].includes(email.status) && (
                        <button
                          onClick={() => handleCancel(email.scheduleId)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded bg-gray-50 border border-gray-200 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded bg-gray-50 border border-gray-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
