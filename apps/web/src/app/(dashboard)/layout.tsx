'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ComposeModal } from '@/components/compose/ComposeModal';
import { emailsApi } from '@/lib/api';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);

  const fetchCounts = async () => {
    try {
      const [scheduledRes, sentRes] = await Promise.all([
        emailsApi.scheduled({ limit: 1 }),
        emailsApi.sent({ limit: 1 }),
      ]);
      setScheduledCount(scheduledRes.meta?.total || 0);
      setSentCount(sentRes.meta?.total || 0);
    } catch {
      // Ignore count fetch errors
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
    if (user) {
      fetchCounts();
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-dark-950 text-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <div className="absolute inset-0 rounded-full blur-md bg-brand-500/30 animate-pulse" />
          </div>
          <p className="text-xs font-mono text-gray-400 tracking-wider uppercase">Authenticating Cluster...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-dark-950 text-gray-100 selection:bg-brand-500/30 font-sans">
      <Sidebar
        onOpenCompose={() => setIsComposeOpen(true)}
        scheduledCount={scheduledCount}
        sentCount={sentCount}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-[#070A12] relative overflow-hidden">
        {/* Ambient background light gradients */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-600/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-[600px] h-[400px] bg-brand-cyan/5 rounded-full blur-[160px] pointer-events-none" />

        <Header />
        <main className="flex-1 p-6 md:p-8 lg:p-10 overflow-y-auto relative z-10">{children}</main>
      </div>

      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={fetchCounts}
      />
    </div>
  );
}
