import axios, { AxiosError } from 'axios';

// Use Next.js API routes as proxy to avoid CORS issues
const API_BASE = '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor — normalize errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    if (error.response?.status === 401) {
      // Redirect to login on auth failure (only in browser)
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  me: () => apiClient.get('/auth/me').then((r) => r.data.data),
  logout: () => apiClient.post('/auth/logout').then((r) => r.data),
  devLogin: (data?: { email?: string; name?: string }) =>
    apiClient.post('/auth/dev-login', data || {}).then((r) => r.data.data),
  googleLoginUrl: `${API_BASE}/auth/google`,
};

// ─── Senders ──────────────────────────────────────────────────────────────────

export const sendersApi = {
  list: () => apiClient.get('/senders').then((r) => r.data.data),
  create: (data: {
    name: string;
    email: string;
    isEthereal?: boolean;
    maxEmailsPerHour?: number;
    minDelayMs?: number;
  }) => apiClient.post('/senders', data).then((r) => r.data.data),
  update: (id: string, data: Partial<{ name: string; maxEmailsPerHour: number; minDelayMs: number }>) =>
    apiClient.patch(`/senders/${id}`, data).then((r) => r.data.data),
  delete: (id: string) => apiClient.delete(`/senders/${id}`).then((r) => r.data),
};

// ─── Schedules ───────────────────────────────────────────────────────────────

export const schedulesApi = {
  list: (params?: { page?: number; limit?: number }) =>
    apiClient.get('/schedules', { params }).then((r) => r.data),
  get: (id: string) => apiClient.get(`/schedules/${id}`).then((r) => r.data.data),
  cancel: (id: string) =>
    apiClient.post(`/schedules/${id}/cancel`).then((r) => r.data),
  parseFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient
      .post('/schedules/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data);
  },
  create: (data: {
    senderId: string;
    subject: string;
    body: string;
    startAt: string;
    recipients?: string[];
    file?: File;
  }) => {
    if (data.file) {
      const formData = new FormData();
      formData.append('senderId', data.senderId);
      formData.append('subject', data.subject);
      formData.append('body', data.body);
      formData.append('startAt', data.startAt);
      formData.append('file', data.file);
      return apiClient
        .post('/schedules', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data);
    }
    return apiClient.post('/schedules', data).then((r) => r.data);
  },
};

// ─── Emails ───────────────────────────────────────────────────────────────────

export const emailsApi = {
  scheduled: (params?: { page?: number; limit?: number }) =>
    apiClient.get('/emails/scheduled', { params }).then((r) => r.data),
  sent: (params?: { page?: number; limit?: number }) =>
    apiClient.get('/emails/sent', { params }).then((r) => r.data),
  get: (id: string) => apiClient.get(`/emails/${id}`).then((r) => r.data.data),
  search: (params: {
    q?: string;
    status?: string;
    senderId?: string;
    page?: number;
    limit?: number;
  }) => apiClient.get('/emails/search', { params }).then((r) => r.data),
};

// ─── Slack ───────────────────────────────────────────────────────────────────

export const slackApi = {
  status: () => apiClient.get('/integrations/slack/status').then((r) => r.data.data),
  connectUrl: `${API_BASE}/integrations/slack/connect`,
  connectWebhook: (data: { webhookUrl: string; channelName?: string }) =>
    apiClient.post('/integrations/slack/webhook', data).then((r) => r.data),
  disconnect: () => apiClient.delete('/integrations/slack').then((r) => r.data),
  notifications: () => apiClient.get('/integrations/slack/notifications').then((r) => r.data.data),
};

// ─── Health ───────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => apiClient.get('/health').then((r) => r.data),
};
