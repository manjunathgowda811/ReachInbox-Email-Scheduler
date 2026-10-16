'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { emailsApi, schedulesApi, sendersApi } from '@/lib/api';
import { NetworkOrb } from '@/components/canvas/NetworkOrb';
import {
  Clock,
  Send,
  Users,
  ChevronRight,
  RefreshCw,
  Zap,
  ShieldCheck,
  Activity,
  Layers,
  ArrowUpRight,
  PlusCircle,
} from 'lucide-react';
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
        schedulesApi.list({ limit: 6 }),
      ]);

      setStats({
        scheduled: scheduledRes.meta?.total || 0,
        sent: sentRes.meta?.total || 0,
        senders: sendersRes?.length || 0,
      });
      setRecentSchedules(schedulesRes?.data || []);
    } catch {
      toast.error('Failed to update telemetry metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto selection:bg-brand-500/30">
      {/* Top Header & Telemetry Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-semibold">
              Telemetry Live
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Control Center
          </h1>
          <p className="text-xs md:text-sm text-gray-400 mt-1">
            Real-time status of persistent worker queues, rate limiter governors, and batch campaigns.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-300 bg-dark-900 border border-white/[0.08] rounded-xl hover:bg-dark-850 hover:text-white transition-all shadow-card focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-400' : 'text-gray-400'}`} />
            <span>Sync Metrics</span>
          </button>
        </div>
      </div>

      {/* 3D Global Telemetry & Architectural Showcase Stage */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-dark-900 via-dark-850 to-dark-950 p-6 md:p-8 shadow-card">
        <div className="absolute inset-0 grid-pattern opacity-25 pointer-events-none" />
        
        {/* Ambient colored lighting */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-brand-500/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-brand-cyan/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Left Text / Specs */}
          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-mono">
              <Zap className="w-3.5 h-3.5 text-brand-cyan" />
              <span>Persistent Outbox • BullMQ Redis Cluster</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              High-Frequency Dispatcher Active
            </h2>
            <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
              Every email payload is safely persisted to PostgreSQL outbox storage before being streamed
              into distributed worker queues. Automatic exponential backoff prevents delivery interruptions.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-mono">
              <div className="flex items-center gap-2 bg-dark-950/70 border border-white/[0.06] px-3 py-1.5 rounded-lg text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Rate Governor: 200/hr</span>
              </div>
              <div className="flex items-center gap-2 bg-dark-950/70 border border-white/[0.06] px-3 py-1.5 rounded-lg text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />
                <span>Inter-Job Delay: 2,000ms</span>
              </div>
              <div className="flex items-center gap-2 bg-dark-950/70 border border-white/[0.06] px-3 py-1.5 rounded-lg text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Outbox Polling: 5,000ms</span>
              </div>
            </div>
          </div>

          {/* Right 3D Visual Mesh Orb Mini-Viewport */}
          <div className="w-full lg:w-72 h-48 md:h-56 relative flex items-center justify-center flex-shrink-0">
            <NetworkOrb className="w-full h-full" particleCount={90} />
            <div className="absolute bottom-1 right-2 text-[10px] font-mono text-gray-500 bg-dark-950/80 px-2 py-0.5 rounded border border-white/[0.06]">
              Interactive Node
            </div>
          </div>
        </div>
      </div>

      {/* Primary Telemetry Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Scheduled Card */}
        <Link
          href="/scheduled"
          className="group relative overflow-hidden rounded-2xl bg-dark-900 border border-white/[0.08] p-6 hover:border-amber-500/40 hover:shadow-card-hover transition-all duration-300 flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors pointer-events-none" />
          
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
              <Clock className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-amber-300 transition-colors" />
          </div>

          <div className="mt-6">
            <p className="text-xs font-mono font-medium text-gray-400 uppercase tracking-wider">
              Scheduled in Queue
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-3xl font-extrabold text-white font-mono">{stats.scheduled}</p>
              <span className="text-[11px] font-mono text-amber-400 font-medium">Pending Release</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Queued for time-based release or rate-limit retry.
            </p>
          </div>
        </Link>

        {/* Successfully Sent Card */}
        <Link
          href="/sent"
          className="group relative overflow-hidden rounded-2xl bg-dark-900 border border-white/[0.08] p-6 hover:border-emerald-500/40 hover:shadow-card-hover transition-all duration-300 flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors pointer-events-none" />

          <div className="flex items-start justify-between">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <Send className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-emerald-300 transition-colors" />
          </div>

          <div className="mt-6">
            <p className="text-xs font-mono font-medium text-gray-400 uppercase tracking-wider">
              Successfully Dispatched
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-3xl font-extrabold text-white font-mono">{stats.sent}</p>
              <span className="text-[11px] font-mono text-emerald-400 font-medium">100% Audit Verified</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Confirmed delivery by upstream SMTP transport.
            </p>
          </div>
        </Link>

        {/* Active Senders Card */}
        <Link
          href="/senders"
          className="group relative overflow-hidden rounded-2xl bg-dark-900 border border-white/[0.08] p-6 hover:border-brand-500/40 hover:shadow-card-hover transition-all duration-300 flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-2xl group-hover:bg-brand-500/10 transition-colors pointer-events-none" />

          <div className="flex items-start justify-between">
            <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300">
              <Users className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-brand-300 transition-colors" />
          </div>

          <div className="mt-6">
            <p className="text-xs font-mono font-medium text-gray-400 uppercase tracking-wider">
              Calibrated Senders
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-3xl font-extrabold text-white font-mono">{stats.senders}</p>
              <span className="text-[11px] font-mono text-brand-300 font-medium">Rate-Guarded</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Configured SMTP pools with automated hourly throttle tracking.
            </p>
          </div>
        </Link>
      </div>

      {/* Recent Campaigns Section */}
      <div className="rounded-2xl border border-white/[0.08] bg-dark-900 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between bg-dark-950/40">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-brand-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Recent Campaign Telemetry
            </h2>
          </div>
          <Link
            href="/scheduled"
            className="text-xs font-medium text-brand-300 hover:text-brand-200 flex items-center gap-1 transition-colors"
          >
            <span>Inspect All Queues</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {recentSchedules.length === 0 ? (
            <div className="py-12 px-6 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-gray-400">
                <Send className="w-5 h-5" />
              </div>
              <p className="text-sm text-gray-400 font-medium">
                No active or queued campaigns recorded yet.
              </p>
              <p className="text-xs text-gray-500">
                Click "+ New Campaign" in the sidebar to schedule your first dispatch.
              </p>
            </div>
          ) : (
            recentSchedules.map((schedule: any) => (
              <div
                key={schedule.id}
                className="p-4 md:px-6 hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-100 group-hover:text-brand-300 transition-colors truncate">
                      {schedule.subject}
                    </p>
                    <span className="text-[10px] font-mono text-gray-500">
                      ID: {schedule.id.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono truncate">
                    Sender: {schedule.sender?.name || schedule.sender?.email} • Recipients: {schedule.totalRecipients}
                  </p>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right font-mono text-xs text-gray-400">
                    <span className="text-gray-200">{schedule.sentCount}</span>
                    <span className="text-gray-600"> / </span>
                    <span>{schedule.totalRecipients} sent</span>
                  </div>

                  <span
                    className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-full border ${
                      schedule.status === 'COMPLETED'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                        : schedule.status === 'PROCESSING'
                        ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/25 animate-pulse'
                        : schedule.status === 'CANCELLED'
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/25'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
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
