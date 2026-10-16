'use client';

import React, { useState, useEffect } from 'react';
import { sendersApi } from '@/lib/api';
import { Mail, Plus, Trash2, Edit2, Check, RefreshCw, X, Sliders } from 'lucide-react';
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
      toast.error('Failed to load senders');
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
      toast.success(isEthereal ? 'Auto-generated Ethereal sender added!' : 'Sender created successfully!');
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
      toast.success('Sender settings updated');
      setEditingSender(null);
      loadSenders();
    } catch {
      toast.error('Failed to update sender');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this sender?')) return;
    try {
      await sendersApi.delete(id);
      toast.success('Sender deactivated');
      loadSenders();
    } catch {
      toast.error('Failed to deactivate sender');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sender Accounts & SMTP</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure SMTP credentials, per-sender hourly throughput limits, and delay intervals.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Sender</span>
        </button>
      </div>

      {/* Senders List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {senders.map((s) => (
          <div
            key={s.id}
            className="p-5 bg-white rounded-2xl border border-gray-100 shadow-card space-y-4 hover:border-gray-200 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 text-base">{s.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{s.email}</p>
              </div>
              {s.isEthereal && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                  Ethereal Mock SMTP
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 pt-2 border-t border-gray-50">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Max Rate</span>
                <span className="font-medium text-gray-900">{s.maxEmailsPerHour} emails / hour</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Min Delay</span>
                <span className="font-medium text-gray-900">{s.minDelayMs} ms between sends</span>
              </div>
              <div className="col-span-2 mt-1">
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Host & Port</span>
                <span className="font-mono text-gray-700">{s.smtpHost}:{s.smtpPort}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-50">
              <button
                onClick={() => setEditingSender(s)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Sliders className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(s.id)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Sender Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-modal overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Add New Sender</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Sender Display Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sales Team"
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Sender Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sales@company.com"
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Ethereal toggle */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-900">
                  <input
                    type="checkbox"
                    checked={isEthereal}
                    onChange={(e) => setIsEthereal(e.target.checked)}
                    className="rounded text-brand-500 focus:ring-brand-500"
                  />
                  <span>Auto-generate Ethereal Test Account (Zero setup SMTP)</span>
                </label>
                <p className="text-xs text-gray-500">
                  Provides full email delivery simulation with web preview URLs for every email.
                </p>
              </div>

              {/* Rate Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Max Emails / Hour
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={maxEmailsPerHour}
                    onChange={(e) => setMaxEmailsPerHour(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Min Delay (ms)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60000"
                    step="500"
                    value={minDelayMs}
                    onChange={(e) => setMinDelayMs(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Creating…' : 'Save Sender'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Limits Modal */}
      {editingSender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-modal overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Configure Rate Limits: {editingSender.name}</h3>
              <button
                onClick={() => setEditingSender(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Sender Name
                </label>
                <input
                  type="text"
                  value={editingSender.name}
                  onChange={(e) => setEditingSender({ ...editingSender, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Max / Hour
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={editingSender.maxEmailsPerHour}
                    onChange={(e) =>
                      setEditingSender({ ...editingSender, maxEmailsPerHour: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Min Delay (ms)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60000"
                    step="500"
                    value={editingSender.minDelayMs}
                    onChange={(e) =>
                      setEditingSender({ ...editingSender, minDelayMs: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingSender(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl shadow-sm"
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
