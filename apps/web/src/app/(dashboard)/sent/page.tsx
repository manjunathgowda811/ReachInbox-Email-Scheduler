'use client';

import React, { useState, useEffect } from 'react';
import { emailsApi } from '@/lib/api';
import { Send, RefreshCw, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
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
      toast.error('Failed to load sent emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSent(page);
  }, [page]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sent Emails</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount} email{totalCount === 1 ? '' : 's'} dispatched via SMTP with audit verification.
          </p>
        </div>
        <button
          onClick={() => loadSent(page)}
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
                <th className="px-6 py-3">Sent At</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Ethereal Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                    No sent emails yet. Compose and schedule your first email!
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
                      {email.sentAt ? format(new Date(email.sentAt), 'MMM d, yyyy HH:mm:ss') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                          email.status === 'SENT'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {email.status === 'SENT' ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {email.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {email.etherealPreviewUrl ? (
                        <a
                          href={email.etherealPreviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
                        >
                          <span>View Email</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
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
