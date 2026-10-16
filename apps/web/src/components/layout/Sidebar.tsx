'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import {
  Clock,
  Send,
  Plus,
  Mail,
  Sliders,
  Radio,
  LogOut,
  ExternalLink,
  LayoutDashboard,
  ShieldCheck,
  Activity,
} from 'lucide-react';

interface SidebarProps {
  onOpenCompose: () => void;
  scheduledCount?: number;
  sentCount?: number;
}

export function Sidebar({
  onOpenCompose,
  scheduledCount = 0,
  sentCount = 0,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isNavActive = (path: string) => pathname === path;

  return (
    <aside className="w-[260px] flex-shrink-0 bg-[#080C14] border-r border-white/[0.07] min-h-screen flex flex-col justify-between p-5 selection:bg-brand-500/30">
      <div className="space-y-6">
        {/* Brand Crest */}
        <div className="space-y-4">
          <Link href="/dashboard" className="flex items-center gap-3 px-1 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white font-bold text-sm shadow-glow tracking-wider group-hover:scale-105 transition-transform">
              RI
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-base tracking-tight">ReachInbox</span>
                <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 uppercase">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-gray-500">Distributed Dispatcher</p>
            </div>
          </Link>

          {/* User Profile Card */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-dark-900/80 border border-white/[0.06] backdrop-blur-sm">
            <div className="relative">
              <img
                src={
                  user?.avatarUrl ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces'
                }
                alt={user?.name || 'User'}
                className="w-9 h-9 rounded-lg object-cover ring-1 ring-white/10"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-dark-950" />
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-200 truncate">
                {user?.name || 'Oliver Brown'}
              </p>
              <p className="text-[11px] text-gray-500 truncate font-mono">
                {user?.email || 'oliver.brown@domain.io'}
              </p>
            </div>
          </div>
        </div>

        {/* Compose Button */}
        <button
          id="btn-compose-modal"
          onClick={onOpenCompose}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold text-sm shadow-glow hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] transition-all duration-200 active:scale-[0.98] border border-brand-400/30"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Campaign</span>
        </button>

        {/* Core Navigation */}
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-mono font-semibold text-gray-500 tracking-widest uppercase mb-2">
            Workspace
          </p>

          <Link
            href="/dashboard"
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isNavActive('/dashboard')
                ? 'bg-brand-500/15 text-brand-300 font-semibold border border-brand-500/30 shadow-sm'
                : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview</span>
            </div>
          </Link>

          <Link
            href="/scheduled"
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isNavActive('/scheduled')
                ? 'bg-brand-500/15 text-brand-300 font-semibold border border-brand-500/30 shadow-sm'
                : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4" />
              <span>Scheduled</span>
            </div>
            {scheduledCount > 0 && (
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {scheduledCount}
              </span>
            )}
          </Link>

          <Link
            href="/sent"
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isNavActive('/sent')
                ? 'bg-brand-500/15 text-brand-300 font-semibold border border-brand-500/30 shadow-sm'
                : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <Send className="w-4 h-4" />
              <span>Sent History</span>
            </div>
            {sentCount > 0 && (
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {sentCount}
              </span>
            )}
          </Link>
        </div>

        {/* Configuration Navigation */}
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-mono font-semibold text-gray-500 tracking-widest uppercase mb-2">
            Infrastructure
          </p>

          <Link
            href="/senders"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isNavActive('/senders')
                ? 'bg-brand-500/15 text-brand-300 font-semibold border border-brand-500/30 shadow-sm'
                : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Senders & SMTP</span>
          </Link>

          <Link
            href="/integrations"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isNavActive('/integrations')
                ? 'bg-brand-500/15 text-brand-300 font-semibold border border-brand-500/30 shadow-sm'
                : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Slack Alerts</span>
          </Link>

          <a
            href="http://localhost:4000/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-white/[0.04] hover:text-gray-200 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Sliders className="w-4 h-4 text-brand-cyan" />
              <span>BullMQ Board</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300" />
          </a>
        </div>
      </div>

      {/* Infrastructure Telemetry & Signout Footer */}
      <div className="space-y-3 pt-4 border-t border-white/[0.07]">
        <div className="p-2.5 rounded-xl bg-dark-900/60 border border-white/[0.04] flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 text-gray-400">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Worker Queue</span>
          </div>
          <span className="font-mono text-emerald-400 font-semibold">Active</span>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20"
        >
          <LogOut className="w-4 h-4" />
          <span>Terminate Session</span>
        </button>
      </div>
    </aside>
  );
}
