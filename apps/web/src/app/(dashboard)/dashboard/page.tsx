'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { emailsApi, schedulesApi, sendersApi } from '@/lib/api';
import { Clock, Send, Users, AlertCircle, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DashboardOverviewPage() {
  const [stats, setStats] = useState({
    scheduled: 0,
    sent: 0,
    senders: 0,
  });
  const [recentSchedules, setRecentSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [scheduledRes, sentRes, sendersRes, schedulesRes] = await Promise.all([
        emailsApi.scheduled({ limit: 1 }),
        emailsApi.sent({ limit: 1 }),
        sendersApi.list(),
        schedulesApi.list({ limit: 5 }),
      ]);

      setStats({
        scheduled: scheduledRes.meta?.total || 0,
        sent: sentRes.meta?.total || 0,
        senders: sendersRes?.length || 0,
      });
      setRecentSchedules(schedulesRes?.data || []);
    } catch (err) {
      toast.error('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Page Title & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Overview Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time status of scheduled dispatches, delivery throughput, and worker queues.
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/scheduled"
          className="p-6 bg-white rounded-2xl border border-gray-100 shadow-card hover:border-brand-200 transition-all flex items-center justify-between group"
        >
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Scheduled Emails
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.scheduled}</p>
            <p className="text-xs text-brand-600 mt-1 font-medium">Pending queue dispatch</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Clock className="w-6 h-6" />
          </div>
        </Link>

        <Link
          href="/sent"
          className="p-6 bg-white rounded-2xl border border-gray-100 shadow-card hover:border-brand-200 transition-all flex items-center justify-between group"
        >
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Successfully Sent
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.sent}</p>
            <p className="text-xs text-green-600 mt-1 font-medium">Delivered with audit log</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Send className="w-6 h-6" />
          </div>
        </Link>

        <Link
          href="/senders"
          className="p-6 bg-white rounded-2xl border border-gray-100 shadow-card hover:border-brand-200 transition-all flex items-center justify-between group"
        >
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Active Senders
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.senders}</p>
            <p className="text-xs text-brand-600 mt-1 font-medium">Rate-limited & calibrated</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Users className="w-6 h-6" />
          </div>
        </Link>
      </div>

      {/* Recent Email Schedules Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Recent Campaigns</h2>
          <Link
            href="/scheduled"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-gray-50">
          {recentSchedules.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              No email campaigns created yet. Click "+ Compose" to start your first campaign!
            </div>
          ) : (
            recentSchedules.map((schedule: any) => (
              <div key={schedule.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900">{schedule.subject}</p>
                  <p className="text-xs text-gray-500">
                    Sender: {schedule.sender?.name} ({schedule.sender?.email}) • Total Recipients: {schedule.totalRecipients}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-xs text-gray-400">
                    <span>Sent: {schedule.sentCount} / {schedule.totalRecipients}</span>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      schedule.status === 'COMPLETED'
                        ? 'bg-green-50 text-green-700'
                        : schedule.status === 'PROCESSING'
                        ? 'bg-blue-50 text-blue-700 animate-pulse'
                        : schedule.status === 'CANCELLED'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {schedule.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
