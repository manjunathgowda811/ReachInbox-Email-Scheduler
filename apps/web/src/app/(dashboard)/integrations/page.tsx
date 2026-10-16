'use client';

import React, { useState, useEffect } from 'react';
import { slackApi } from '@/lib/api';
import { Radio, CheckCircle, AlertCircle, Link as LinkIcon, RefreshCw, X, ShieldAlert } from 'lucide-react';
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
      toast.error('Failed to load integration data');
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
      toast.success('Slack webhook connected successfully!');
      setWebhookUrl('');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to connect webhook');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Slack?')) return;
    try {
      await slackApi.disconnect();
      toast.success('Slack integration disconnected');
      loadData();
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Slack Alert Integrations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Receive real-time alerts whenever a sender hits their hourly limit and email jobs get rescheduled.
        </p>
      </div>

      {/* Connection Status Card */}
      <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-card flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              status.connected
                ? 'bg-green-50 text-green-600'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-base">Slack Alerts</h3>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  status.connected
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {status.connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            {status.connected ? (
              <p className="text-xs text-gray-500 mt-0.5">
                Channel: <span className="font-medium text-gray-800">{status.channelName || '#general'}</span> • Team:{' '}
                <span className="font-medium text-gray-800">{status.teamName || 'Workspace'}</span>
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-0.5">
                Connect your Slack workspace via OAuth or an incoming webhook URL.
              </p>
            )}
          </div>
        </div>

        {status.connected ? (
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-colors"
          >
            Disconnect
          </button>
        ) : (
          <a
            href={slackApi.connectUrl}
            className="px-4 py-2 text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl shadow-sm transition-all"
          >
            Connect via OAuth
          </a>
        )}
      </div>

      {/* Direct Incoming Webhook Option */}
      {!status.connected && (
        <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-card space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 text-base">
              Quick Connect via Incoming Webhook URL
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Test Slack notifications instantly without setting up a full Slack app OAuth flow.
            </p>
          </div>

          <form onSubmit={handleWebhookConnect} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Webhook URL
              </label>
              <input
                type="url"
                required
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T.../B.../..."
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Display Channel Name
              </label>
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="#email-alerts"
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Connecting…' : 'Save Webhook & Activate'}
            </button>
          </form>
        </div>
      )}

      {/* Information Box */}
      <div className="p-5 rounded-2xl bg-brand-50 border border-brand-100 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-brand-900 space-y-1">
          <p className="font-semibold">Per-Window Rate Limit Deduplication</p>
          <p className="text-brand-800">
            Slack notifications are automatically deduplicated so you only receive one alert per sender
            per UTC hour window, even if hundreds of email jobs are rate-limited simultaneously.
          </p>
        </div>
      </div>

      {/* Rate Limit Notification Center / Simulation Feed */}
      <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 text-base">Rate Limit Notification Feed</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              History of sender quota alerts dispatched to Slack or recorded locally in Showcase Mode.
            </p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {notifications.length === 0 ? (
          <div className="p-8 text-center bg-gray-50/70 rounded-xl border border-dashed border-gray-200">
            <Radio className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-medium text-gray-500">No rate limit alerts recorded yet</p>
            <p className="text-[11px] text-gray-400 mt-1">
              Trigger a test by setting a low sender limit (e.g. 2 emails/hour in Senders tab) and scheduling a campaign.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notif: any) => (
              <div key={notif.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-xs font-semibold text-gray-900">{notif.title}</span>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    {new Date(notif.sentAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-gray-600 pl-4">{notif.description}</p>
                <div className="pl-4 flex items-center gap-2">
                  <span className="inline-flex text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                    {notif.notice}
                  </span>
                  <span className="text-[11px] text-gray-400 font-mono">Window: {notif.windowKey}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
