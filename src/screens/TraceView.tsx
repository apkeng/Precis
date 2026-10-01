import { useState } from 'react';
import { api } from '../api';
import type { EventSummary, Period, Quiz, RelationKind, Tone } from '../api';
import { Tags } from '../components/Tags';
import { fmtDate, rangeLabel } from '../lib/dates';
import { errorMessage, useAsync } from '../lib/useAsync';
import { FORMAT_IDS, TOPICS_BY_ID, TOPIC_IDS } from '../topics';

interface Props {
  eventId: string;
  period: Period;
  onPick: (id: string) => void;
  onBack: () => void;
  onOpenEvent: (id: string) => void;
  onWiden: (p: Period) => void;
  onQuiz: (quiz: Quiz) => void;
}

const TONE_BG: Record<Tone, string> = {
  Explanatory: 'var(--rose)',
  Critical: 'var(--rose-soft)',
  Neutral: 'var(--sand)',
};

type FlowKind = RelationKind | 'self';
const FLOW_STYLE: Record<FlowKind, { label: string; dot: string; ring: string; kindColor: string }> = {
  self: { label: 'This story', dot: 'var(--accent)', ring: 'var(--accent)', kindColor: 'var(--accent)' },
  direct: { label: 'Direct link', dot: 'var(--rose-dot)', ring: 'var(--box)', kindColor: 'var(--ink-2)' },
  theme: { label: 'Same theme', dot: 'var(--field)', ring: 'var(--box)', kindColor: 'var(--muted)' },
};

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export function TraceView({ eventId, period, onPick, onBack, onOpenEvent, onWiden, onQuiz }: Props) {
  const trace = useAsync(() => api.trace(eventId, period), [eventId, period.from, period.to]);
  const choices = useAsync(() => api.listEvents(period, TOPIC_IDS), [period.from, period.to]);
  const [quizState, setQuizState] = useState<'idle' | 'loading' | string>('idle');
  const range = rangeLabel(period.from, period.to);

  const t = trace.data?.event.id === eventId ? trace.data : undefined;
  if (!t) {
    return (
      <main className="trace">
        <button className="back" onClick={onBack}>
          ← Back to event
        </button>
        {trace.status === 'error' ? (
          <div className="notice">Couldn’t analyse this story: {trace.error}</div>
        ) : (
          <div className="loading">Tracing the story across {range}…</div>
        )}
      </main>
    );
  }

  const story = t.event;
  const rel = t.related;
  const total = t.days.reduce((a, d) => a + d.story, 0);
  const peak = t.days.reduce((a, d) => (d.story > a.story ? d : a), t.days[0] ?? { date: story.date, story: 0 });
  const maxV = Math.max(1, ...t.days.map((d) => d.story + d.related));
  const step = t.days.length > 45 ? 14 : 7;
  const relDates = new Set(rel.map((r) => r.event.date));

  const direct = rel.filter((r) => r.kind === 'direct').length;
  const theme = rel.length - direct;
  const linkLine = !rel.length
    ? ''
    : direct && theme
      ? `${direct} directly connected; ${theme} share a syllabus theme.`
      : direct
        ? `${direct === 1 ? 'It is' : 'All are'} directly connected.`
        : `${theme === 1 ? 'It shares' : 'All share'} a syllabus theme.`;

  const flow: { e: EventSummary; kind: FlowKind; reason: string }[] = [
    { e: story, kind: 'self' as const, reason: 'The story being analysed.' },
    ...rel.map((r) => ({ e: r.event, kind: r.kind, reason: r.reason })),
  ].sort((a, b) => (a.e.date < b.e.date ? -1 : 1));

  const thread = [story, ...rel.map((r) => r.event)];
  const threads = [...new Set(thread.flatMap((e) => e.topics))]
    .map((id) => ({ id, n: thread.filter((e) => e.topics.includes(id)).length }))
    .sort((a, b) => b.n - a.n);

  const startThreadQuiz = async () => {
    setQuizState('loading');
    try {
      const quiz = await api.createQuiz({
        ...period,
        topics: threads.map((x) => x.id),
        formats: FORMAT_IDS,
        length: 10,
        difficulty: 'Mixed',
        eventIds: thread.map((e) => e.id),
      });
      if (!quiz.questions.length) return setQuizState('No questions could be grounded in this thread.');
      setQuizState('idle');
      onQuiz(quiz);
    } catch (err) {
      setQuizState(errorMessage(err));
    }
  };

  const options = choices.data?.events ?? [];
  return (
    <main className="trace">
      <div className="trace-top">
        <button className="back" onClick={onBack}>
          ← Back to event
        </button>
        <label className="story-picker">
          Story
          <select value={story.id} onChange={(e) => onPick(e.target.value)}>
            {!options.some((o) => o.id === story.id) && <option value={story.id}>{pickLabel(story)}</option>}
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {pickLabel(o)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="trace-head">
        <div className="eyebrow accent" style={{ fontSize: 13 }}>
          Story analysis · {range}
        </div>
        <h1>{story.title}</h1>
        <p>
          Traced across {range}: {total} clippings on this story and {plural(rel.length, 'related event')} in the
          same period. {linkLine}
        </p>
      </div>

      <section className="card chart-card">
        <div className="chart-head">
          <div className="section-title">Coverage over the period</div>
          <div className="legend">
            <span>
              <i style={{ background: 'var(--accent)' }} />
              This story
            </span>
            <span>
              <i style={{ background: 'var(--rose-bar)' }} />
              Related events
            </span>
          </div>
        </div>
        <div className="trace-stats">
          {[
            [total, 'clippings on this story'],
            [fmtDate(peak.date, true), 'peak coverage'],
            [t.days.filter((d) => d.story > 0).length, 'days in the news'],
            [rel.length, 'related events'],
          ].map(([v, k]) => (
            <div key={k}>
              <span className="v">{v}</span>
              <span className="k">{k}</span>
            </div>
          ))}
        </div>
        <div className="bars">
          {t.days.map((d) => (
            <div key={d.date} title={`${fmtDate(d.date, true)} · ${d.story} on story, ${d.related} related`}>
              <span className="story-bar" style={{ height: `${(d.story / maxV) * 100}%` }} />
              <span className="rel-bar" style={{ height: `${(d.related / maxV) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="axis">
          {t.days.map((d, i) => (
            <div key={d.date}>
              <span
                className="dot"
                style={{
                  background:
                    d.date === story.date ? 'var(--accent)' : relDates.has(d.date) ? 'var(--rose-dot)' : 'transparent',
                }}
              />
              <span className="label">{i % step === 0 ? fmtDate(d.date, true) : ''}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="trace-body">
        <section className="flow">
          <div className="section-title">How the story connects</div>
          {flow.map(({ e, kind, reason }) => {
            const s = FLOW_STYLE[kind];
            return (
              <div key={e.id} className="flow-row">
                <span className="date">{fmtDate(e.date, true)}</span>
                <div className="rail">
                  <span className="stem" style={{ height: 18 }} />
                  <span className="node" style={{ background: s.dot, boxShadow: `0 0 0 1px ${s.ring}` }} />
                  <span className="stem" style={{ flex: 1 }} />
                </div>
                <button
                  className={'flow-card' + (kind === 'self' ? ' self' : '')}
                  onClick={() => (kind === 'self' ? onOpenEvent(e.id) : onPick(e.id))}
                >
                  <div className="tagrow">
                    <span className="kind" style={{ color: s.kindColor }}>
                      {s.label}
                    </span>
                    <Tags topics={e.topics} />
                  </div>
                  <div className="title">{e.title}</div>
                  <div className="reason">{reason}</div>
                </button>
              </div>
            );
          })}
          {t.outsideCount > 0 && t.outsideRange && (
            <div className="notice outside">
              <span>
                {t.outsideCount} related event{t.outsideCount === 1 ? ' sits' : 's sit'} outside this period.
              </span>
              <button className="link" onClick={() => onWiden(t.outsideRange!)}>
                Widen period to include
              </button>
            </div>
          )}
        </section>

        <aside className="trace-side">
          <div className="stack">
            <div className="section-title">How papers framed it</div>
            {t.framing.map((f) => (
              <div key={f.paper} className="card framing">
                <div className="top">
                  <span>{f.paper}</span>
                  <span className="tone" style={{ background: TONE_BG[f.tone] }}>
                    {f.tone}
                  </span>
                </div>
                <div className="angle">“{f.angle}”</div>
                <div className="count">{plural(f.clippingCount, 'clipping')}</div>
              </div>
            ))}
          </div>
          <div className="stack">
            <div className="section-title">Syllabus threads</div>
            <div className="chips">
              {threads.map((x) => (
                <span key={x.id} className="thread">
                  {TOPICS_BY_ID[x.id]?.name ?? x.id} <span className="muted">· {x.n}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="rose-panel">
            <div className="title">Quiz on the whole thread</div>
            <div className="note">
              {quizState !== 'idle' && quizState !== 'loading'
                ? quizState
                : `Questions across this story and its ${plural(rel.length, 'related event')}.`}
            </div>
            <button className="btn primary sm" onClick={startThreadQuiz} disabled={quizState === 'loading'}>
              {quizState === 'loading' ? 'Drafting questions…' : 'Start thread quiz →'}
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}

function pickLabel(e: EventSummary): string {
  return `${fmtDate(e.date, true)} — ${e.title.split(';')[0]}`;
}
