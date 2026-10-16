'use client';

import React, { useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { authApi } from '@/lib/api';
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
      toast.success('Welcome back, Oliver!');
    } catch {
      toast.error('Could not log in as demo user');
      setLoadingDemo(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-card border border-gray-100">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white font-bold text-xl shadow-sm">
            ONB
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">
            ReachInbox Email Scheduler
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Sign in to manage and schedule enterprise email campaigns with distributed queues
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {/* Demo Login Button */}
          <button
            type="button"
            id="demo-login-btn"
            onClick={handleDemoLogin}
            disabled={loadingDemo}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60"
          >
            {loadingDemo ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Signing in…
              </span>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Demo Login — Continue as Oliver Brown
              </>
            )}
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink mx-4 text-xs font-medium text-gray-400 uppercase">
              Or with Google OAuth
            </span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          {/* Google OAuth Login */}
          <a
            href={authApi.googleLoginUrl}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            Sign in with Google
          </a>
        </div>

        <div className="text-center pt-2">
          <p className="text-xs text-gray-400">
            Rate limiting: 200/hr • Delay: 2s • Backoff & Outbox Reliability
          </p>
        </div>
      </div>
    </div>
  );
}
