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
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="text-sm text-gray-500">Authenticating…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        onOpenCompose={() => setIsComposeOpen(true)}
        scheduledCount={scheduledCount}
        sentCount={sentCount}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>

      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={fetchCounts}
      />
    </div>
  );
}
