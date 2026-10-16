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
  Inbox,
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
    <aside className="w-[230px] flex-shrink-0 bg-white border-r border-gray-100 min-h-screen flex flex-col justify-between p-4">
      <div className="space-y-6">
        {/* Brand Logo & User */}
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white font-bold text-sm tracking-wider shadow-sm">
              ONB
            </div>
            <span className="font-semibold text-gray-900 text-base">ReachInbox</span>
          </div>

          {/* User Profile Card */}
          <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 border border-gray-100">
            <img
              src={
                user?.avatarUrl ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces'
              }
              alt={user?.name || 'User'}
              className="w-8 h-8 rounded-full object-cover border border-gray-200"
            />
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-gray-900 truncate">
                {user?.name || 'Oliver Brown'}
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                {user?.email || 'oliver.brown@domain.io'}
              </p>
            </div>
          </div>
        </div>

        {/* Compose Button */}
        <button
          id="btn-compose-modal"
          onClick={onOpenCompose}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm shadow-sm transition-all transform active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Compose</span>
        </button>

        {/* Core Navigation */}
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-semibold text-gray-400 tracking-wider uppercase mb-2">
            Core
          </p>

          <Link
            href="/dashboard"
            className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              isNavActive('/dashboard')
                ? 'bg-brand-50 text-brand-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Inbox className="w-4 h-4" />
              <span>Overview</span>
            </div>
          </Link>

          <Link
            href="/scheduled"
            className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              isNavActive('/scheduled')
                ? 'bg-brand-50 text-brand-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4" />
              <span>Scheduled</span>
            </div>
            {scheduledCount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {scheduledCount}
              </span>
            )}
          </Link>

          <Link
            href="/sent"
            className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              isNavActive('/sent')
                ? 'bg-brand-50 text-brand-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Send className="w-4 h-4" />
              <span>Sent</span>
            </div>
            {sentCount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {sentCount}
              </span>
            )}
          </Link>
        </div>

        {/* Settings Navigation */}
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-semibold text-gray-400 tracking-wider uppercase mb-2">
            Settings & Integrations
          </p>

          <Link
            href="/senders"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              isNavActive('/senders')
                ? 'bg-brand-50 text-brand-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Senders & SMTP</span>
          </Link>

          <Link
            href="/integrations"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              isNavActive('/integrations')
                ? 'bg-brand-50 text-brand-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Slack Alerts</span>
          </Link>

          <a
            href="http://localhost:4000/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Sliders className="w-4 h-4" />
              <span>Bull Board</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
          </a>
        </div>
      </div>

      {/* Logout Footer */}
      <div className="pt-4 border-t border-gray-100">
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
