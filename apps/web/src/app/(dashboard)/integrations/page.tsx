'use client';

import React, { useState, useEffect } from 'react';
import { slackApi } from '@/lib/api';
import { Radio, CheckCircle2, AlertCircle, Link as LinkIcon, RefreshCw, X, ShieldAlert, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

export default function IntegrationsPage() {
  const [status, setStatus] = useState<any>({ connected: false });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channelName, setChannelName] = useState('#email-alerts');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statusData, notifsData] = await Promise.all([
        slackApi.status().catch(() => ({ connected: false })),
        slackApi.notifications().catch(() => []),
      ]);
      setStatus(statusData || { connected: false });
      setNotifications(notifsData || []);
    } catch {
      toast.error('Failed to load integration status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleWebhookConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      toast.error('Please enter a valid Slack webhook URL (https://hooks.slack.com/...)');
      return;
    }
    setSubmitting(true);
    try {
      await slackApi.connectWebhook({ webhookUrl, channelName });
      toast.success('Slack webhook registered successfully!');
      setWebhookUrl('');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to connect webhook');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Slack notifications?')) return;
    try {
      await slackApi.disconnect();
      toast.success('Slack integration disconnected');
      loadData();
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto selection:bg-brand-500/30">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-brand-emerald animate-pulse" />
          <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-semibold">
            Real-Time Alerting
          </span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Slack Telemetry Integrations
        </h1>
        <p className="text-xs md:text-sm text-gray-400 mt-1">
          Automate instant incident alerts whenever a sender identity hits their hourly rate limit.
        </p>
      </div>

      {/* Connection Status Card */}
      <div className="p-6 bg-dark-900 rounded-2xl border border-white/[0.08] shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
              status.connected
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                : 'bg-white/[0.04] text-gray-400 border-white/[0.08]'
            }`}
          >
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="font-bold text-white text-base">Slack Webhook Relay</h3>
              <span
                className={`text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                  status.connected
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-white/[0.05] text-gray-400 border-white/[0.08]'
                }`}
              >
                {status.connected ? 'Active • Relaying Alerts' : 'Disconnected'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">
              Target Channel: {status.channelName || '#email-alerts'}
            </p>
          </div>
        </div>

        {status.connected && (
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all"
          >
            Disconnect Relay
          </button>
        )}
      </div>

      {/* Connect Webhook Form */}
      {!status.connected && (
        <div className="p-6 bg-dark-900 rounded-2xl border border-white/[0.08] shadow-card space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Connect Slack Incoming Webhook</h3>
            <p className="text-xs text-gray-400">
              Provide an Incoming Webhook URL configured in your Slack app directory.
            </p>
          </div>

          <form onSubmit={handleWebhookConnect} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider mb-1">
                Webhook URL
              </label>
              <input
                type="url"
                required
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T.../B.../..."
                className="w-full px-3.5 py-2.5 text-xs font-mono bg-dark-850 border border-white/[0.08] rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider mb-1">
                Channel Identifier
              </label>
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="#email-alerts"
                className="w-full px-3.5 py-2.5 text-xs font-mono bg-dark-850 border border-white/[0.08] rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 rounded-xl shadow-glow transition-all active:scale-[0.98] border border-brand-400/30"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>{submitting ? 'Authenticating Hook…' : 'Establish Slack Link'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Alert Audit Trail */}
      <div className="bg-dark-900 rounded-2xl border border-white/[0.08] shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between bg-dark-950/60">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono">
              Rate Limit Incident Log
            </h3>
          </div>
          <span className="text-[11px] font-mono text-gray-500">
            {notifications.length} recent event{notifications.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {notifications.length === 0 ? (
            <div className="py-12 px-6 text-center text-xs text-gray-500">
              No rate limit incidents recorded. All sender accounts operating within allocated thresholds.
            </div>
          ) : (
            notifications.map((n: any, idx: number) => (
              <div key={idx} className="p-4 px-6 flex items-center justify-between hover:bg-white/[0.02]">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-gray-200">{n.message || 'Sender rate limit exceeded'}</p>
                  <p className="text-[11px] text-gray-500 font-mono">
                    Sender: {n.senderEmail} • Rescheduled {n.rescheduledCount} pending email(s)
                  </p>
                </div>
                <span className="text-[10px] font-mono text-gray-400">
                  {n.createdAt ? new Date(n.createdAt).toLocaleTimeString() : 'Just now'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
