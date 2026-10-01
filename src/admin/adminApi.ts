// Admin endpoints of precis-backend. Every call carries the signed-in
// user's Firebase ID token; the backend rejects anyone who isn't internal.

import { requestJson } from '../api/http';

export interface Edition {
  id: string;
  paper: string;
  date: string;
  pages: number;
  pagesDone: number;
  status: 'processing' | 'ready' | 'failed';
  error: string | null;
  createdAt: string;
  uploadedBy: string | null;
  /** Articles by status: ready, off_syllabus, failed, processing. */
  clippings: Partial<Record<ArticleStatus, number>>;
  events: number;
}

export type ArticleStatus = 'processing' | 'ready' | 'off_syllabus' | 'failed';

export interface Article {
  id: string;
  page: number | null;
  title: string;
  status: ArticleStatus;
  error: string | null;
  eventId: string | null;
  eventTitle: string | null;
}

export function adminApi(baseUrl: string, idToken: () => Promise<string>) {
  const base = baseUrl.replace(/\/+$/, '');
  const call = async <T>(path: string, init?: RequestInit) =>
    requestJson<T>(base, path, {
      ...init,
      headers: { Authorization: `Bearer ${await idToken()}` },
    });

  return {
    me: () => call<{ email: string }>('/admin/me'),
    editions: () => call<{ editions: Edition[]; papers: string[] }>('/admin/editions'),
    articles: (id: string) => call<{ articles: Article[] }>(`/admin/editions/${encodeURIComponent(id)}/articles`),
    upload(file: File, paper: string, date: string) {
      const form = new FormData();
      form.append('file', file);
      form.append('paper', paper);
      form.append('date', date);
      return call<Edition>('/editions/pdf', { method: 'POST', body: form });
    },
  };
}

export type AdminApi = ReturnType<typeof adminApi>;
