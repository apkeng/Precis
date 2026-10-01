import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/http';
import { adminApi } from './adminApi';

describe('adminApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends a fresh ID token with every call and uploads as multipart', async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response('{}', { status: 202 }));
    vi.stubGlobal('fetch', fetch);
    let n = 0;
    const api = adminApi('http://api.test/', async () => `token-${++n}`);

    await api.me();
    await api.upload(new File(['%PDF'], 'paper.pdf', { type: 'application/pdf' }), 'The Hindu', '2026-10-01');

    const [meUrl, meInit] = fetch.mock.calls[0];
    expect(meUrl).toBe('http://api.test/admin/me');
    expect(new Headers(meInit.headers).get('Authorization')).toBe('Bearer token-1');

    const [upUrl, upInit] = fetch.mock.calls[1];
    expect(upUrl).toBe('http://api.test/editions/pdf');
    const headers = new Headers(upInit.headers);
    expect(headers.get('Authorization')).toBe('Bearer token-2');
    expect(headers.get('Content-Type')).toBeNull(); // the browser sets the multipart boundary
    const form = upInit.body as FormData;
    expect(form.get('paper')).toBe('The Hindu');
    expect(form.get('date')).toBe('2026-10-01');
    expect((form.get('file') as File).name).toBe('paper.pdf');
  });

  it('surfaces the backend refusal for non-internal accounts', async () => {
    const detail = "The admin panel is for verified @apokryfon.com accounts; you're signed in as a@gmail.com.";
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ detail }), { status: 403 })));
    await expect(adminApi('http://api.test', async () => 't').me()).rejects.toEqual(new ApiError(403, detail));
  });
});
