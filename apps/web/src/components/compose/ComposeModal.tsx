'use client';

import React, { useState, useEffect } from 'react';
import { X, UploadCloud, Calendar, Clock, Send, Check, AlertCircle } from 'lucide-react';
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSenders();
      // Default to 1 hour from now for "later"
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
      toast.success(`Found ${parsed.validCount} valid recipients in ${file.name}`);
    } catch {
      toast.error('Failed to parse recipient file');
      setUploadedFile(null);
      setFileStats(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSenderId) {
      toast.error('Please select a sender');
      return;
    }

    if (!subject.trim()) {
      toast.error('Subject is required');
      return;
    }

    if (!body.trim()) {
      toast.error('Body is required');
      return;
    }

    // Resolve recipients
    let recipientsList: string[] = [];
    if (!uploadedFile) {
      recipientsList = recipientsInput
        .split(/[,\n ]+/)
        .map((e) => e.trim())
        .filter((e) => Boolean(e) && e.includes('@'));

      if (recipientsList.length === 0) {
        toast.error('Please enter at least one valid recipient email or upload a CSV');
        return;
      }
    }

    // Determine start timestamp
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
          ? 'Email dispatch started!'
          : 'Email campaign scheduled!'
      );

      // Reset and close
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-modal overflow-hidden border border-gray-100 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />
            <h3 className="font-semibold text-gray-900 text-base">New Email Campaign</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Sender Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              From (Sender Account)
            </label>
            <select
              value={selectedSenderId}
              onChange={(e) => setSelectedSenderId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email}) {s.isEthereal ? '— [Ethereal Test SMTP]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Recipients / File Upload */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                To (Recipients)
              </label>
              <label
                htmlFor="file-upload"
                className="text-xs font-medium text-brand-600 hover:text-brand-700 cursor-pointer flex items-center gap-1"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Upload CSV / TXT
              </label>
              <input
                id="file-upload"
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {uploadedFile ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-brand-50 border border-brand-200 text-sm">
                <div className="flex items-center gap-2 text-brand-800">
                  <Check className="w-4 h-4 text-brand-600" />
                  <span className="font-medium">{uploadedFile.name}</span>
                  {fileStats && (
                    <span className="text-xs text-brand-700">
                      ({fileStats.validCount} valid emails)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUploadedFile(null);
                    setFileStats(null);
                  }}
                  className="text-brand-600 hover:text-brand-800 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <textarea
                value={recipientsInput}
                onChange={(e) => setRecipientsInput(e.target.value)}
                placeholder="sarah@example.com, john@domain.io or paste multiple emails"
                rows={2}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Follow up on our meeting regarding ReachInbox"
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Email Body */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Message Body (HTML supported)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi there,<br><br>We wanted to reach out and follow up..."
              rows={6}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
            />
          </div>

          {/* Scheduling Timing */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Delivery Schedule
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                <input
                  type="radio"
                  name="scheduleType"
                  value="now"
                  checked={scheduleType === 'now'}
                  onChange={() => setScheduleType('now')}
                  className="text-brand-500 focus:ring-brand-500"
                />
                <span>Send Immediately (with rate limiting & delays)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                <input
                  type="radio"
                  name="scheduleType"
                  value="later"
                  checked={scheduleType === 'later'}
                  onChange={() => setScheduleType('later')}
                  className="text-brand-500 focus:ring-brand-500"
                />
                <span>Schedule for Later</span>
              </label>
            </div>

            {scheduleType === 'later' && (
              <div className="pt-2">
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            )}
          </div>

          {/* Actions Footer */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Enqueuing Jobs…</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>
                    {scheduleType === 'now' ? 'Send Campaign Now' : 'Schedule Campaign'}
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
