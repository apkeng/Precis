# Précis

News analysis for civil-services aspirants. Pick a period and the syllabus
topics you care about, read Claude's source-cited analysis of each event,
trace how a story connects to others across the period, and quiz yourself
on what happened. Every answer and question is grounded in the newspaper
clippings ingested for that period.

This repo is the frontend (React + Vite + TypeScript). The RAG backend is a
separate repo, **precis-backend** (FastAPI, Chroma, local embeddings and
Claude).

## Screens

| Screen | What it does |
|---|---|
| **Explore** | Period bar with presets, the 14 topics grouped Prelims / GS I–IV, the lead story and the event list, and coverage per topic |
| **Event** | Analysis with clickable `[n]` citations that highlight the source clipping, Prelims facts, a Mains question, a timeline, "Ask the sources" and a short practice quiz |
| **Story analysis** | Day-by-day coverage of the story and its related events, how they connect (direct link or shared theme), events outside the period, how each paper framed it, syllabus threads and a thread quiz |
| **Quiz setup → quiz → results** | Topics, formats (MCQ, statement, assertion–reason, match), length and difficulty. Questions link back to their source. Results break the score down by topic and offer a retry of the wrong answers |
| **Admin** (`/admin`) | Internal only. Sign in with Google (@apokryfon.com), upload a day's e-paper PDF, follow ingestion page by page, and see each article's outcome: filed under an event, off-syllabus, or failed |

The design and its history are in `project/Precis.dc.html` and
`chats/chat1.md`. `HANDOFF.md` is the original handoff note.

## Run

```bash
npm install
npm run dev            # http://localhost:5173
```

With no configuration, the app runs on the design's built-in sample data,
and a "Sample data" badge shows in the period bar. To use the real backend:

```bash
cp .env.example .env.local   # VITE_API_URL=http://localhost:8000
npm run dev
```

On the backend, `CORS_ALLOWED_ORIGINS` must include the frontend's origin.
Its default covers `http://localhost:5173`.

### Admin panel

`/admin` is the internal ingestion panel. It signs in with Google through
the Précis Firebase project, **newsdigest-9fd33**, whose web config is
built into `src/admin/firebase.ts`. `VITE_FIREBASE_*` env vars override it
(see `.env.example`). The panel also needs `VITE_API_URL` set to the backend.

Firebase setup status:

- [x] Google sign-in provider enabled
- [x] Web app registered
- [ ] Production domain added under **Authentication → Settings →
      Authorized domains** (`localhost` works already, for local development)

Access is enforced by the backend, not the page. It verifies each request's
Firebase ID token and accepts only verified emails on its
`ADMIN_EMAIL_DOMAIN` (`apokryfon.com`). Anyone else who signs in sees a
refusal, and the admin API returns 403. The reader app doesn't link to
`/admin`, and the panel's code and Firebase SDK load only on that path.

Hosting has to serve `index.html` for `/admin` (single-page-app fallback).
Vite's dev and preview servers already do.

Other scripts: `npm run build`, `npm run typecheck`, `npm test`.

## Structure

```
src/
  api/types.ts     PrecisApi interface + domain types (the backend contract)
  api/http.ts      PrecisApi over precis-backend
  api/mock.ts      PrecisApi over the design's sample data (api/mockData.ts)
  api/index.ts     picks one from VITE_API_URL
  admin/           /admin: Google sign-in (Firebase), admin API client, panel
  screens/         Explore, EventView, TraceView, QuizSetup, QuizRun, Results
  components/      Tags, Cited (inline [n] citations)
  lib/             dates (local-time ISO dates), period presets, useAsync
  topics.ts        the 14 topics, groups and question formats
  styles.css       design tokens and styles
```

Screens only depend on `PrecisApi`, so another data source plugs in by
implementing that interface.

## Notes

- **Font.** Headlines use Putrey with Petrona for body text, as designed.
  Putrey loads from cdnfonts.com and falls back to Young Serif. The free
  Putrey is a demo licensed for personal use only, so a public launch needs
  the commercial licence from Alit Design.
- **Period presets** count back from today against the backend: last 7
  days, this month, last two months, last 90 days. Against the sample data
  they count back from 30 Sep 2026, which gives the design's presets.
- **Short quizzes.** The backend writes *up to* the requested number of
  questions. When a period can't support that many, the quiz header says how
  many were requested and how many could be grounded.
- The event screen's story-analysis button no longer shows the
  related-event count from the design. Getting that count means running the
  story analysis, which calls Claude, every time an event opens.
