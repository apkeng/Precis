import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../api/http';
import { fmtDate, today } from '../lib/dates';
import { errorMessage, useAsync } from '../lib/useAsync';
import { adminApi, type AdminApi, type Article, type ArticleStatus, type Edition } from './adminApi';
import { ADMIN_DOMAIN, missingFirebaseConfig, signIn, signOut, watchUser, type User } from './firebase';

const API_URL = import.meta.env.VITE_API_URL as string | undefined;
const POLL_MS = 5000;

/** /admin — newspaper ingestion, for signed-in internal users only. */
export default function AdminApp() {
  const missing = [...(API_URL ? [] : ['VITE_API_URL']), ...missingFirebaseConfig];
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {missing.length ? (
        <Shell>
          <Gate title="The admin panel isn’t configured">
            Set {missing.join(', ')} in <code>.env.local</code> (see <code>.env.example</code>) and restart the app.
          </Gate>
        </Shell>
      ) : (
        <SignedInArea />
      )}
    </div>
  );
}

function Shell({ email, children }: { email?: string; children: React.ReactNode }) {
  return (
    <>
      <header className="masthead">
        <div className="masthead-inner" style={{ paddingBottom: 14, alignItems: 'baseline' }}>
          <div className="brand">
            <a href="/" className="brand-name" style={{ color: 'var(--ink)', textDecoration: 'none' }}>
              Précis
            </a>
            <div className="eyebrow">Admin · Newspaper ingestion</div>
          </div>
          <div className="admin-user">
            {email && (
              <>
                <span>{email}</span>
                <button className="link" onClick={() => signOut()}>
                  Sign out
                </button>
              </>
            )}
            <a href="/">Reader app →</a>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}

function Gate({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <main className="admin-gate">
      <div className="card admin-gate-card">
        <div className="eyebrow accent">Internal</div>
        <h1>{title}</h1>
        <div className="note">{children}</div>
        {action}
      </div>
    </main>
  );
}

type Access = { state: 'checking' } | { state: 'ok' } | { state: 'denied'; message: string } | { state: 'error'; message: string };

function SignedInArea() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [access, setAccess] = useState<Access>({ state: 'checking' });
  useEffect(() => watchUser(setUser), []);

  const api = useMemo(() => (user ? adminApi(API_URL!, () => user.getIdToken()) : null), [user]);
  useEffect(() => {
    if (!api) return;
    setAccess({ state: 'checking' });
    api.me().then(
      () => setAccess({ state: 'ok' }),
      (err) =>
        setAccess(
          err instanceof ApiError && (err.status === 401 || err.status === 403)
            ? { state: 'denied', message: err.message }
            : { state: 'error', message: errorMessage(err) },
        ),
    );
  }, [api]);

  if (user === undefined) {
    return (
      <Shell>
        <main className="admin-gate">
          <div className="loading">Checking sign-in…</div>
        </main>
      </Shell>
    );
  }
  if (!user || !api) {
    const start = () => {
      setSignInError(null);
      signIn().catch((err) => {
        // Closing the popup isn't an error worth showing.
        if (!String(err?.code).includes('popup-closed')) setSignInError(errorMessage(err));
      });
    };
    return (
      <Shell>
        <Gate
          title="Sign in to ingest newspapers"
          action={
            <>
              <button className="btn primary" onClick={start}>
                Sign in with Google
              </button>
              {signInError && <div className="error">{signInError}</div>}
            </>
          }
        >
          This panel is for the Précis team. Use your @{ADMIN_DOMAIN} Google account.
        </Gate>
      </Shell>
    );
  }

  const email = user.email ?? 'Signed in';
  if (access.state === 'checking') {
    return (
      <Shell email={email}>
        <main className="admin-gate">
          <div className="loading">Checking access…</div>
        </main>
      </Shell>
    );
  }
  if (access.state !== 'ok') {
    return (
      <Shell email={email}>
        <Gate
          title={access.state === 'denied' ? 'This account can’t use the admin panel' : 'Couldn’t check your access'}
          action={
            <button className="btn outline" onClick={() => signOut()}>
              Sign out and switch account
            </button>
          }
        >
          {access.message}
        </Gate>
      </Shell>
    );
  }
  return (
    <Shell email={email}>
      <Ingest api={api} />
    </Shell>
  );
}

function Ingest({ api }: { api: AdminApi }) {
  const [editions, setEditions] = useState<Edition[] | null>(null);
  const [papers, setPapers] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const refresh = () =>
    api.editions().then(
      (r) => {
        setEditions(r.editions);
        setPapers(r.papers);
        setLoadError(null);
      },
      (err) => setLoadError(errorMessage(err)),
    );
  useEffect(() => {
    refresh();
  }, [api]);

  // Poll while anything is still being processed.
  const busy = editions?.some((e) => e.status === 'processing') ?? false;
  useEffect(() => {
    if (!busy) return;
    const t = window.setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [busy, api]);

  return (
    <main className="admin">
      <UploadForm
        api={api}
        papers={papers}
        onUploaded={(e) => {
          setEditions((list) => [e, ...(list ?? [])]);
          setOpen(e.id);
        }}
      />
      <section className="admin-editions">
        <div className="section-title" style={{ paddingBottom: 10 }}>
          Editions
        </div>
        {loadError && <div className="notice">Couldn’t load editions: {loadError}</div>}
        {!editions && !loadError && <div className="loading">Loading editions…</div>}
        {editions && !editions.length && (
          <div className="notice">Nothing ingested yet. Upload an e-paper PDF to start.</div>
        )}
        {editions?.map((e) => (
          <EditionRow
            key={e.id}
            api={api}
            edition={e}
            open={open === e.id}
            onToggle={() => setOpen(open === e.id ? null : e.id)}
          />
        ))}
      </section>
    </main>
  );
}

function UploadForm({ api, papers, onUploaded }: { api: AdminApi; papers: string[]; onUploaded: (e: Edition) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [paper, setPaper] = useState('');
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0); // remounts the file input to clear it

  const pickFile = (f: File | null) => {
    setFile(f);
    const isPdf = f && (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    setError(f && !isPdf ? 'That isn’t a PDF.' : null);
    // e-paper names like "th.th_international.01_10_2026.pdf" carry the date.
    const m = f?.name.match(/(\d{2})[._-](\d{2})[._-](\d{4})/);
    if (m) setDate(`${m[3]}-${m[2]}-${m[1]}`);
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!file || !paper.trim() || !date || busy) return;
    setBusy(true);
    setError(null);
    try {
      onUploaded(await api.upload(file, paper.trim(), date));
      setFile(null);
      setInputKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="rose-panel admin-upload" onSubmit={submit}>
      <div className="eyebrow rose">Ingest an edition</div>
      <div className="title">Upload a day’s e-paper</div>
      <div className="note">
        Every page is split into articles. News and opinion pieces are tagged with syllabus topics and filed under
        events; the rest is skipped. An 18-page edition takes a few minutes.
      </div>
      <label className="admin-field">
        <span>PDF</span>
        <input
          key={inputKey}
          type="file"
          accept="application/pdf"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          required
        />
      </label>
      <div className="admin-row">
        <label className="admin-field" style={{ flex: '1 1 150px' }}>
          <span>Newspaper</span>
          <input
            className="date-input"
            list="known-papers"
            value={paper}
            onChange={(e) => setPaper(e.target.value)}
            placeholder="e.g. The Hindu"
            required
          />
          <datalist id="known-papers">
            {papers.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <label className="admin-field" style={{ flex: '0 0 150px' }}>
          <span>Edition date</span>
          <input className="date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn primary" type="submit" disabled={!file || !paper.trim() || !date || busy || !!error}>
        {busy ? 'Uploading…' : 'Upload and ingest →'}
      </button>
    </form>
  );
}

const STATUS_LABEL: Record<ArticleStatus, string> = {
  ready: 'Filed',
  off_syllabus: 'Off-syllabus',
  failed: 'Failed',
  processing: 'Processing',
};

function EditionRow({ api, edition: e, open, onToggle }: { api: AdminApi; edition: Edition; open: boolean; onToggle: () => void }) {
  const c = e.clippings;
  const filed = c.ready ?? 0;
  const pct = e.pages ? (e.pagesDone / e.pages) * 100 : 0;
  const counts = [
    `${filed} article${filed === 1 ? '' : 's'} filed into ${e.events} event${e.events === 1 ? '' : 's'}`,
    c.off_syllabus ? `${c.off_syllabus} off-syllabus` : '',
    c.failed ? `${c.failed} failed` : '',
  ].filter(Boolean);

  return (
    <div className={'card admin-edition' + (open ? ' open' : '')}>
      <button className="admin-edition-head" onClick={onToggle} aria-expanded={open}>
        <div className="admin-edition-main">
          <div className="admin-edition-title">
            {e.paper} · {fmtDate(e.date)}
          </div>
          <div className="meta">
            Uploaded {new Date(e.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {e.uploadedBy ? ` by ${e.uploadedBy}` : ''}
          </div>
        </div>
        <span className={'admin-status ' + e.status}>
          {e.status === 'processing'
            ? e.pages
              ? `Page ${e.pagesDone} of ${e.pages}`
              : 'Starting…'
            : e.status === 'ready'
              ? 'Done'
              : 'Failed'}
        </span>
      </button>
      {e.status === 'processing' && (
        <span className="bar-track">
          <span style={{ width: `${pct}%`, background: 'var(--accent)' }} />
        </span>
      )}
      <div className="admin-counts">{counts.join(' · ')}</div>
      {e.error && <div className="error">{e.error}</div>}
      {open && <Articles api={api} edition={e} />}
    </div>
  );
}

function Articles({ api, edition }: { api: AdminApi; edition: Edition }) {
  // Reload whenever the edition's progress changes (it's polled while processing).
  const signature = `${edition.pagesDone}|${JSON.stringify(edition.clippings)}`;
  const articles = useAsync(() => api.articles(edition.id), [edition.id, signature]);
  const list: Article[] = articles.data?.articles ?? [];

  if (articles.status === 'error') return <div className="error">Couldn’t load articles: {articles.error}</div>;
  if (!articles.data) return <div className="loading">Loading articles…</div>;
  if (!list.length) return <div className="meta">No articles yet.</div>;
  return (
    <div className="admin-articles">
      {list.map((a) => (
        <div key={a.id} className="admin-article">
          <span className="meta">p.{a.page ?? '?'}</span>
          <div>
            <div className="admin-article-title">{a.title}</div>
            {a.eventTitle && a.status === 'ready' && <div className="meta">Event: {a.eventTitle}</div>}
            {a.error && <div className="error">{a.error}</div>}
          </div>
          <span className={'admin-article-status ' + a.status}>{STATUS_LABEL[a.status]}</span>
        </div>
      ))}
    </div>
  );
}
