import type { DocumentJobResponse, InboxItem, Invoice, InvoiceFields, Job } from './types';

type ErrorBody = { error?: string };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...options, cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as T & ErrorBody;
  if (!res.ok) {
    const message = data.error || `Request failed (${res.status})`;
    console.error(`[api] ${options.method || 'GET'} ${path}`, res.status, data);
    throw new Error(message);
  }
  return data;
}

export type InboxPage = {
  items: InboxItem[];
  total: number;
  limit: number;
  offset: number;
};

export function fetchInbox(params: { limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams();
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.offset != null) query.set('offset', String(params.offset));
  const suffix = query.toString() ? `?${query}` : '';
  return request<InboxPage>(`/api/inbox${suffix}`);
}

export type SampleKey = 'clean' | 'mismatch' | 'missing' | 'euro' | 'baddate';

export function startSample(key: SampleKey) {
  return request<DocumentJobResponse>(`/api/documents/samples/${key}`, { method: 'POST' });
}

export function uploadPdf(file: File) {
  const body = new FormData();
  body.append('file', file);
  return request<DocumentJobResponse>('/api/documents', { method: 'POST', body });
}

export function fetchJob(id: string) {
  return request<Job>(`/api/jobs/${id}`);
}

export function retryJob(id: string) {
  return request<Pick<Job, 'id' | 'status'>>(`/api/jobs/${id}/retry`, { method: 'POST' });
}

export function fetchInvoice(id: string) {
  return request<Invoice>(`/api/invoices/${id}`);
}

export function saveInvoice(id: string, fields: Partial<Record<keyof InvoiceFields, unknown>>) {
  return request<Invoice>(`/api/invoices/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
}
