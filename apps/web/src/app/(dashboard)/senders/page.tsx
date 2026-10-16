'use client';

import React, { useState, useEffect } from 'react';
import { sendersApi } from '@/lib/api';
import { Mail, Plus, Trash2, Edit2, Check, RefreshCw, X, Sliders, ShieldCheck, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SendersPage() {
  const [senders, setSenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSender, setEditingSender] = useState<any | null>(null);

  // New sender form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isEthereal, setIsEthereal] = useState(true);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [maxEmailsPerHour, setMaxEmailsPerHour] = useState(200);
  const [minDelayMs, setMinDelayMs] = useState(2000);
  const [submitting, setSubmitting] = useState(false);

  const loadSenders = async () => {
    setLoading(true);
    try {
      const data = await sendersApi.list();
      setSenders(data || []);
    } catch {
      toast.error('Failed to load senders list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSenders();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await sendersApi.create({
        name,
        email,
        isEthereal,
        ...(isEthereal
          ? {}
          : { smtpHost, smtpPort, smtpUser, smtpPass }),
        maxEmailsPerHour,
        minDelayMs,
      });
      toast.success(isEthereal ? 'Auto-generated Ethereal sandbox sender added!' : 'Sender created successfully!');
      setIsAddModalOpen(false);
      setName('');
      setEmail('');
      loadSenders();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create sender');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSender) return;
    try {
      await sendersApi.update(editingSender.id, {
        name: editingSender.name,
        maxEmailsPerHour: editingSender.maxEmailsPerHour,
        minDelayMs: editingSender.minDelayMs,
      });
      toast.success('Rate governor updated for sender');
      setEditingSender(null);
      loadSenders();
    } catch {
      toast.error('Failed to update sender');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this sender profile?')) return;
    try {
      await sendersApi.delete(id);
      toast.success('Sender profile deactivated');
      loadSenders();
    } catch {
      toast.error('Failed to deactivate sender');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto selection:bg-brand-500/30">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-brand-cyan animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-brand-cyan font-semibold">
              SMTP Relay Network
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Senders & SMTP Throttle
          </h1>
          <p className="text-xs md:text-sm text-gray-400 mt-1">
            Calibrate hourly dispatch velocity, inter-job delay intervals, and test sandboxes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 rounded-xl shadow-glow transition-all active:scale-[0.98] border border-brand-400/30"
          >
            <Plus className="w-4 h-4" />
            <span>Add Sender</span>
          </button>
        </div>
      </div>

      {/* Senders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {senders.map((s) => (
          <div
            key={s.id}
            className="rounded-2xl border border-white/[0.08] bg-dark-900 p-6 shadow-card hover:border-white/[0.15] transition-all flex flex-col justify-between group"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-300">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">{s.name}</h3>
                    <p className="text-xs text-gray-400 font-mono">{s.email}</p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                    s.isEthereal
                      ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/25'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                  }`}
                >
                  {s.isEthereal ? 'Ethereal Sandbox' : 'Custom SMTP'}
                </span>
              </div>

              {/* Rate Limit Meter */}
              <div className="p-3.5 rounded-xl bg-dark-850/80 border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-400">Hourly Velocity Cap:</span>
                  <span className="text-white font-semibold">{s.maxEmailsPerHour} emails/hr</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-400">Inter-Email Stagger:</span>
                  <span className="text-brand-300 font-semibold">{s.minDelayMs} ms</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-white/[0.06]">
              <button
                onClick={() => setEditingSender(s)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-gray-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors border border-white/[0.06]"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Configure Rate</span>
              </button>
              <button
                onClick={() => handleDelete(s.id)}
                className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                title="Deactivate sender"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Sender Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md font-sans">
          <div className="bg-dark-900 w-full max-w-lg rounded-2xl border border-white/[0.1] shadow-modal overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between bg-dark-950/60">
              <h3 className="font-bold text-white text-base">Add Sender Identity</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sales Outreach"
                  className="w-full px-3.5 py-2 text-xs font-mono bg-dark-850 border border-white/[0.08] rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider mb-1">
                  Sender Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sales@domain.io"
                  className="w-full px-3.5 py-2 text-xs font-mono bg-dark-850 border border-white/[0.08] rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-dark-850 border border-white/[0.06] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-gray-200">Use Ethereal Test SMTP</span>
                  <p className="text-[11px] text-gray-400">Auto-provisions a disposable test inbox with web links</p>
                </div>
                <input
                  type="checkbox"
                  checked={isEthereal}
                  onChange={(e) => setIsEthereal(e.target.checked)}
                  className="w-4 h-4 accent-brand-500"
                />
              </div>

              {!isEthereal && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-mono text-gray-400 mb-1">SMTP Host</label>
                    <input
                      type="text"
                      required
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.mailgun.org"
                      className="w-full px-3 py-1.5 text-xs font-mono bg-dark-850 border border-white/[0.08] rounded-lg text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-gray-400 mb-1">Port</label>
                    <input
                      type="number"
                      required
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs font-mono bg-dark-850 border border-white/[0.08] rounded-lg text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-gray-400 mb-1">Username</label>
                    <input
                      type="text"
                      required
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono bg-dark-850 border border-white/[0.08] rounded-lg text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-gray-400 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono bg-dark-850 border border-white/[0.08] rounded-lg text-gray-100"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-gray-400 mb-1">Rate Limit (per hr)</label>
                  <input
                    type="number"
                    value={maxEmailsPerHour}
                    onChange={(e) => setMaxEmailsPerHour(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono bg-dark-850 border border-white/[0.08] rounded-xl text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-gray-400 mb-1">Delay (ms)</label>
                  <input
                    type="number"
                    value={minDelayMs}
                    onChange={(e) => setMinDelayMs(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono bg-dark-850 border border-white/[0.08] rounded-xl text-gray-100"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-glow transition-all"
                >
                  {submitting ? 'Creating Identity…' : 'Save Identity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Sender Modal */}
      {editingSender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md font-sans">
          <div className="bg-dark-900 w-full max-w-md rounded-2xl border border-white/[0.1] shadow-modal overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between bg-dark-950/60">
              <h3 className="font-bold text-white text-base">Configure Rate Limiter</h3>
              <button
                onClick={() => setEditingSender(null)}
                className="p-1 rounded text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">Sender Name</label>
                <input
                  type="text"
                  value={editingSender.name}
                  onChange={(e) => setEditingSender({ ...editingSender, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-dark-850 border border-white/[0.08] rounded-xl text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">Max Emails Per Hour</label>
                <input
                  type="number"
                  value={editingSender.maxEmailsPerHour}
                  onChange={(e) =>
                    setEditingSender({ ...editingSender, maxEmailsPerHour: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-dark-850 border border-white/[0.08] rounded-xl text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">Delay Between Jobs (ms)</label>
                <input
                  type="number"
                  value={editingSender.minDelayMs}
                  onChange={(e) =>
                    setEditingSender({ ...editingSender, minDelayMs: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-dark-850 border border-white/[0.08] rounded-xl text-gray-100"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setEditingSender(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-glow transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
