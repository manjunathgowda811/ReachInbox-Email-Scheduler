'use client';

import React, { useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { authApi } from '@/lib/api';
import { NetworkOrb } from '@/components/canvas/NetworkOrb';
import { ShieldCheck, Zap, Server, Activity, ArrowRight, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { devLogin } = useAuth();
  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleDemoLogin = async () => {
    setLoadingDemo(true);
    try {
      await devLogin({
        email: 'oliver.brown@domain.io',
        name: 'Oliver Brown',
      });
      toast.success('Authenticated session established');
    } catch {
      toast.error('Could not authenticate demo session');
      setLoadingDemo(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex bg-dark-950 text-gray-100 overflow-hidden font-sans selection:bg-brand-500/30">
      {/* Ambient background glow points */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/15 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute -bottom-40 right-1/4 w-[32rem] h-[32rem] bg-brand-cyan/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Left Column: 3D Telemetry & Visual Stage (Hidden on mobile, dominant on desktop) */}
      <div className="hidden lg:flex lg:w-7/12 relative flex-col justify-between p-12 border-r border-white/[0.06] bg-gradient-to-br from-dark-950 via-dark-900 to-dark-850">
        {/* Subtle grid background */}
        <div className="absolute inset-0 grid-pattern opacity-40 pointer-events-none" />

        {/* 3D Interactive Canvas Scene */}
        <div className="absolute inset-0 flex items-center justify-center">
          <NetworkOrb className="w-full h-full max-w-2xl max-h-[700px]" particleCount={160} />
        </div>

        {/* Top Header Badge */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white font-bold text-base shadow-glow tracking-wider">
            RI
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-lg tracking-tight">ReachInbox</span>
              <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                v2.4 Core
              </span>
            </div>
            <p className="text-xs text-gray-400">High-Throughput Campaign Orchestration</p>
          </div>
        </div>

        {/* Center Architectural Headline */}
        <div className="relative z-10 max-w-xl space-y-4 my-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-brand-300 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Distributed Outbox Engine • Active
          </div>
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
            Surgical precision for enterprise email pipelines.
          </h1>
          <p className="text-base text-gray-400 leading-relaxed font-light">
            Engineered with Redis BullMQ persistent queue state, distributed rate calibration,
            and millisecond-accurate batch dispatching with zero message loss.
          </p>

          {/* Feature Telemetry Grid */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="p-3.5 rounded-xl bg-dark-900/60 border border-white/[0.06] backdrop-blur-md">
              <div className="flex items-center gap-2 text-brand-cyan mb-1">
                <Zap className="w-4 h-4" />
                <span className="text-xs font-mono font-semibold">2,000/hr</span>
              </div>
              <p className="text-[11px] text-gray-400">Strict Rate Calibrated</p>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-900/60 border border-white/[0.06] backdrop-blur-md">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <Activity className="w-4 h-4" />
                <span className="text-xs font-mono font-semibold">0.04ms</span>
              </div>
              <p className="text-[11px] text-gray-400">Queue Polling Tick</p>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-900/60 border border-white/[0.06] backdrop-blur-md">
              <div className="flex items-center gap-2 text-brand-400 mb-1">
                <Server className="w-4 h-4" />
                <span className="text-xs font-mono font-semibold">ACID Outbox</span>
              </div>
              <p className="text-[11px] text-gray-400">Dual-Write Safe</p>
            </div>
          </div>
        </div>

        {/* Bottom Status Ticker */}
        <div className="relative z-10 flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>NODE: us-east-worker-01</span>
          </div>
          <span className="font-mono text-[11px]">Ethereal & Custom SMTP Ready</span>
        </div>
      </div>

      {/* Right Column: Refined Authentication Portal */}
      <div className="w-full lg:w-5/12 flex flex-col justify-center px-6 sm:px-12 xl:px-16 py-12 relative z-20">
        <div className="max-w-md w-full mx-auto space-y-8">
          {/* Header Mobile Brand */}
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white font-bold text-base shadow-glow">
              RI
            </div>
            <div>
              <span className="font-bold text-white text-lg">ReachInbox</span>
              <p className="text-xs text-gray-400">Email Scheduler</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Production Showcase Ready</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Welcome back
            </h2>
            <p className="text-sm text-gray-400">
              Access the distributed email scheduling cluster and audit logs.
            </p>
          </div>

          {/* Authentication Actions */}
          <div className="space-y-4 pt-2">
            {/* Primary Demo Login */}
            <button
              type="button"
              id="demo-login-btn"
              onClick={handleDemoLogin}
              disabled={loadingDemo}
              className="w-full relative group overflow-hidden rounded-xl p-[1px] focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-dark-950"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-brand-500 via-brand-cyan to-brand-400 rounded-xl transition-all duration-300 group-hover:opacity-100 opacity-80" />
              <div className="relative flex items-center justify-between px-5 py-3.5 bg-dark-900 rounded-[11px] transition-colors group-hover:bg-dark-850">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-9 h-9 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-300">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      <span>One-Click Demo Session</span>
                      <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        INSTANT
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">Continue as Oliver Brown (Admin)</p>
                  </div>
                </div>

                {loadingDemo ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
                )}
              </div>
            </button>

            {/* Divider */}
            <div className="relative flex py-3 items-center">
              <div className="flex-grow border-t border-white/[0.08]" />
              <span className="flex-shrink mx-4 text-xs font-mono uppercase tracking-wider text-gray-500">
                Or Single Sign-On
              </span>
              <div className="flex-grow border-t border-white/[0.08]" />
            </div>

            {/* Google OAuth Login */}
            <a
              href={authApi.googleLoginUrl}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-sm font-medium text-gray-200 bg-dark-900 border border-white/[0.08] hover:bg-dark-800 hover:border-white/[0.15] transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/50 shadow-card"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continue with Google Workspace</span>
            </a>
          </div>

          {/* Micro Footer specs */}
          <div className="pt-6 border-t border-white/[0.06] text-center space-y-2">
            <p className="text-xs text-gray-500">
              Strict delivery calibration: <span className="text-gray-300 font-mono">200 emails/hr</span> per sender.
            </p>
            <p className="text-[11px] text-gray-600">
              Encrypted session tokens • Protected by PostgreSQL transactional outbox
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
