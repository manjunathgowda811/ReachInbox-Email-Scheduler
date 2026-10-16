'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  UploadCloud,
  Clock,
  Send,
  Check,
  Zap,
  Eye,
  Edit3,
  FileText,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { sendersApi, schedulesApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ComposeModal({ isOpen, onClose, onSuccess }: ComposeModalProps) {
  const [senders, setSenders] = useState<any[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [recipientsInput, setRecipientsInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileStats, setFileStats] = useState<{ validCount: number; duplicates: number } | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [activeTab, setActiveTab] = useState<'compose' | 'preview'>('compose');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSenders();
      const d = new Date(Date.now() + 60 * 60 * 1000);
      d.setMinutes(0, 0, 0);
      setScheduledDateTime(d.toISOString().slice(0, 16));
    }
  }, [isOpen]);

  const loadSenders = async () => {
    try {
      const data = await sendersApi.list();
      setSenders(data || []);
      if (data && data.length > 0) {
        setSelectedSenderId(data[0].id);
      }
    } catch {
      toast.error('Failed to load email senders');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    try {
      const parsed = await schedulesApi.parseFile(file);
      setFileStats({
        validCount: parsed.validCount,
        duplicates: parsed.duplicates,
      });
      toast.success(`Loaded ${parsed.validCount} valid recipients from ${file.name}`);
    } catch {
      toast.error('Failed to parse recipient file');
      setUploadedFile(null);
      setFileStats(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSenderId) {
      toast.error('Please select an active sender account');
      return;
    }

    if (!subject.trim()) {
      toast.error('Subject line is required');
      return;
    }

    if (!body.trim()) {
      toast.error('Email body content is required');
      return;
    }

    let recipientsList: string[] = [];
    if (!uploadedFile) {
      recipientsList = recipientsInput
        .split(/[,\n ]+/)
        .map((e) => e.trim())
        .filter((e) => Boolean(e) && e.includes('@'));

      if (recipientsList.length === 0) {
        toast.error('Please specify valid recipient emails or upload a CSV');
        return;
      }
    }

    const startAt =
      scheduleType === 'now'
        ? new Date().toISOString()
        : new Date(scheduledDateTime).toISOString();

    setSubmitting(true);
    try {
      await schedulesApi.create({
        senderId: selectedSenderId,
        subject,
        body,
        startAt,
        recipients: uploadedFile ? undefined : recipientsList,
        file: uploadedFile || undefined,
      });

      toast.success(
        scheduleType === 'now'
          ? 'Email dispatch enqueued to BullMQ!'
          : 'Email campaign scheduled successfully!'
      );

      setSubject('');
      setBody('');
      setRecipientsInput('');
      setUploadedFile(null);
      setFileStats(null);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to schedule emails';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentSender = senders.find((s) => s.id === selectedSenderId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in selection:bg-brand-500/30 font-sans">
      <div className="bg-dark-900 w-full max-w-2xl rounded-2xl shadow-modal overflow-hidden border border-white/[0.1] flex flex-col max-h-[92vh] relative">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-brand-500/50 to-transparent pointer-events-none" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between bg-dark-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-300">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base tracking-tight">New Dispatch Campaign</h3>
              <p className="text-[11px] text-gray-400 font-mono">Calibrated via Outbox Queue</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch */}
            <div className="flex p-0.5 rounded-lg bg-dark-800 border border-white/[0.06] text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('compose')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                  activeTab === 'compose'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Composer</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                  activeTab === 'preview'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'compose' ? (
            <>
              {/* Sender Select */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">
                    From (Sender Identity)
                  </label>
                  {currentSender && (
                    <span className="text-[11px] font-mono text-emerald-400">
                      Rate: {currentSender.maxEmailsPerHour || 200}/hr • Delay: {currentSender.minDelayMs || 2000}ms
                    </span>
                  )}
                </div>
                <select
                  value={selectedSenderId}
                  onChange={(e) => setSelectedSenderId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-dark-850 border border-white/[0.08] rounded-xl text-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                >
                  {senders.map((s) => (
                    <option key={s.id} value={s.id} className="bg-dark-900 text-gray-200">
                      {s.name} ({s.email}) {s.isEthereal ? '• [Auto Ethereal SMTP]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Recipients Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">
                    To (Recipients Target)
                  </label>
                  <label
                    htmlFor="file-upload-modal"
                    className="text-xs font-mono font-medium text-brand-300 hover:text-brand-200 cursor-pointer flex items-center gap-1.5 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-md transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload CSV / TXT</span>
                  </label>
                  <input
                    id="file-upload-modal"
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {uploadedFile ? (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-brand-500/10 border border-brand-500/30 text-xs font-mono">
                    <div className="flex items-center gap-2.5 text-brand-200">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="font-semibold text-white">{uploadedFile.name}</span>
                      {fileStats && (
                        <span className="text-gray-400">
                          ({fileStats.validCount} valid entries, {fileStats.duplicates} dupes omitted)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedFile(null);
                        setFileStats(null);
                      }}
                      className="text-gray-400 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <textarea
                    value={recipientsInput}
                    onChange={(e) => setRecipientsInput(e.target.value)}
                    placeholder="sarah@enterprise.io, david@growth.com (comma or newline separated)"
                    rows={2}
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-dark-850 border border-white/[0.08] rounded-xl text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                )}
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Schedule sync regarding ReachInbox deployment"
                  className="w-full px-3.5 py-2.5 text-sm bg-dark-850 border border-white/[0.08] rounded-xl text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              {/* Message Body */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">
                    Message Body (HTML Supported)
                  </label>
                  <span className="text-[10px] font-mono text-gray-500">HTML tags allowed</span>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Hi there,<br><br>Excited to connect with you regarding our enterprise email infrastructure..."
                  rows={5}
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-dark-850 border border-white/[0.08] rounded-xl text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              {/* Timing & Delivery Options */}
              <div className="p-4 rounded-xl bg-dark-850/80 border border-white/[0.07] space-y-3">
                <label className="block text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">
                  Dispatch Execution Strategy
                </label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-gray-300">
                    <input
                      type="radio"
                      name="scheduleType"
                      value="now"
                      checked={scheduleType === 'now'}
                      onChange={() => setScheduleType('now')}
                      className="accent-brand-500"
                    />
                    <span>Stream Immediately (Rate-Governed)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-gray-300">
                    <input
                      type="radio"
                      name="scheduleType"
                      value="later"
                      checked={scheduleType === 'later'}
                      onChange={() => setScheduleType('later')}
                      className="accent-brand-500"
                    />
                    <span>Schedule Release Timestamp</span>
                  </label>
                </div>

                {scheduleType === 'later' && (
                  <div className="pt-2">
                    <input
                      type="datetime-local"
                      value={scheduledDateTime}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      className="px-3 py-2 text-xs font-mono bg-dark-900 border border-white/[0.1] rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Live HTML Preview Pane */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-dark-850 border border-white/[0.06] space-y-2">
                <p className="text-xs font-mono text-gray-400">
                  <span className="text-gray-500">SUBJECT: </span>
                  <span className="text-white font-semibold">{subject || '(No subject specified)'}</span>
                </p>
                <p className="text-xs font-mono text-gray-400">
                  <span className="text-gray-500">SENDER: </span>
                  <span className="text-brand-300">{currentSender?.name} &lt;{currentSender?.email}&gt;</span>
                </p>
              </div>

              <div className="p-6 rounded-xl bg-white text-gray-900 min-h-[220px] shadow-sm text-sm">
                {body ? (
                  <div dangerouslySetInnerHTML={{ __html: body }} />
                ) : (
                  <div className="text-center text-gray-400 pt-10 text-xs">
                    No message content entered in composer.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/[0.07]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-xl transition-colors"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 rounded-xl shadow-glow transition-all active:scale-[0.98] disabled:opacity-50 border border-brand-400/30"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Enqueuing to Redis BullMQ…</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {scheduleType === 'now' ? 'Dispatch Campaign Now' : 'Lock & Schedule Dispatch'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
