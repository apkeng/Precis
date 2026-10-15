import { useMemo, useState, type ReactNode } from 'react';
import { api, referenceDate } from '../api';
import type { EventSummary, Period, Quiz, RelatedEvent, RelationKind, Tone } from '../api';
import { Tags } from '../components/Tags';
import { addDays, fmtDate, rangeLabel } from '../lib/dates';
import { errorMessage, useAsync } from '../lib/useAsync';
import { FORMAT_IDS, GROUPS, TOPICS, TOPICS_BY_ID, TOPIC_IDS } from '../topics';

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

type LinkKind = RelationKind | 'self';
const LINK_STYLE: Record<LinkKind, { label: string; color: string }> = {
  self: { label: 'This story', color: 'var(--accent)' },
  direct: { label: 'Direct link', color: 'var(--ink-2)' },
  theme: { label: 'Same theme', color: 'var(--muted)' },
};

type DateKey = 'today' | 'yesterday' | '7' | '30' | 'period' | 'custom';
type Scope = 'all' | 'linked';

/** The timeline filter. It starts on the current date only, all topics. */
interface Filter {
  dateKey: DateKey;
  range: Period;
  /** Individual days picked within the range; empty means every day. */
  days: string[];
  topics: string[];
  scope: Scope;
  query: string;
}

const todayOnly = (): Filter => ({
  dateKey: 'today',
  range: { from: referenceDate, to: referenceDate },
  days: [],
  topics: TOPIC_IDS,
  scope: 'all',
  query: '',
});

const DATE_CHOICES: [Exclude<DateKey, 'custom'>, string][] = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['7', 'Last 7 days'],
  ['30', 'Last 30 days'],
  ['period', 'Selected period'],
];

function dateRange(key: Exclude<DateKey, 'custom'>, period: Period): Period {
  const ref = referenceDate;
  if (key === 'today') return { from: ref, to: ref };
  if (key === 'yesterday') return { from: addDays(ref, -1), to: addDays(ref, -1) };
  if (key === '7') return { from: addDays(ref, -6), to: ref };
  if (key === '30') return { from: addDays(ref, -29), to: ref };
  return period;
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export function TraceView({ eventId, period, onPick, onBack, onOpenEvent, onWiden, onQuiz }: Props) {
  const trace = useAsync(() => api.trace(eventId, period), [eventId, period.from, period.to]);
  const choices = useAsync(() => api.listEvents(period, TOPIC_IDS), [period.from, period.to]);
  const [filter, setFilter] = useState<Filter>(todayOnly);
  const fr = filter.range;
  // Every event in the filter's dates; topics, days and search narrow it client-side.
  const pool = useAsync(() => api.listEvents(fr, TOPIC_IDS), [fr.from, fr.to]);
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

  const direct = rel.filter((r) => r.kind === 'direct').length;
  const theme = rel.length - direct;
  const linkLine = !rel.length
    ? ''
    : direct && theme
      ? `${direct} directly connected; ${theme} share a syllabus theme.`
      : direct
        ? `${direct === 1 ? 'It is' : 'All are'} directly connected.`
        : `${theme === 1 ? 'It shares' : 'All share'} a syllabus theme.`;

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
          Event chronology · {range}
        </div>
        <h1>{story.title}</h1>
        <p>
          Traced across {range}: {total} clippings on this story and {plural(rel.length, 'related event')} in the
          same period. {linkLine}
        </p>
      </div>

      <div className="trace-body">
        <Chronology
          story={story}
          related={rel}
          period={period}
          filter={filter}
          setFilter={setFilter}
          pool={pool.data?.events}
          poolStatus={pool.status}
          poolError={pool.status === 'error' ? pool.error : null}
          onOpenEvent={onOpenEvent}
        >
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
        </Chronology>

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

interface ChronologyProps {
  story: EventSummary;
  related: RelatedEvent[];
  period: Period;
  filter: Filter;
  setFilter: (f: Filter) => void;
  pool: EventSummary[] | undefined;
  poolStatus: string;
  poolError?: string | null;
  onOpenEvent: (id: string) => void;
  children?: ReactNode;
}

/** The filterable timeline: events across topics and dates, oldest first,
 * with this story and its related events marked. */
function Chronology(p: ChronologyProps) {
  const { story, related, filter, setFilter } = p;
  const { range, days, topics, scope, query } = filter;
  const set = (patch: Partial<Filter>) => setFilter({ ...filter, ...patch });
  const setRange = (dateKey: DateKey, r: Period) => set({ dateKey, range: r, days: [] });

  const links = useMemo(() => {
    const m = new Map<string, { kind: LinkKind; reason: string }>([
      [story.id, { kind: 'self', reason: 'The story being analysed.' }],
    ]);
    for (const r of related) m.set(r.event.id, { kind: r.kind, reason: r.reason });
    return m;
  }, [story, related]);

  const inRange = (e: EventSummary) => e.date >= range.from && e.date <= range.to;
  const base = scope === 'linked' ? [story, ...related.map((r) => r.event)].filter(inRange) : (p.pool ?? []);
  const q = query.trim().toLowerCase();
  const matchesQuery = (e: EventSummary) =>
    !q || e.title.toLowerCase().includes(q) || e.dek.toLowerCase().includes(q);
  const matchesTopics = (e: EventSummary) => e.topics.some((id) => topics.includes(id));
  const matchesDays = (e: EventSummary) => !days.length || days.includes(e.date);

  // Each chip's count reflects every other filter but its own.
  const dayCounts = new Map<string, number>();
  for (const e of base)
    if (matchesQuery(e) && matchesTopics(e)) dayCounts.set(e.date, (dayCounts.get(e.date) ?? 0) + 1);
  const topicCounts: Record<string, number> = {};
  for (const e of base)
    if (matchesQuery(e) && matchesDays(e)) for (const id of e.topics) topicCounts[id] = (topicCounts[id] ?? 0) + 1;

  const shown = base
    .filter((e) => matchesQuery(e) && matchesTopics(e) && matchesDays(e))
    .sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title) : a.date < b.date ? -1 : 1));
  const byDate: [string, EventSummary[]][] = [];
  for (const e of shown) {
    const last = byDate[byDate.length - 1];
    if (last && last[0] === e.date) last[1].push(e);
    else byDate.push([e.date, [e]]);
  }
  const clippings = shown.reduce((a, e) => a + e.clippingCount, 0);

  const toggleTopic = (id: string) =>
    set({ topics: topics.includes(id) ? topics.filter((x) => x !== id) : [...topics, id] });
  const toggleGroup = (group: string) => {
    const ids = TOPICS.filter((x) => x.group === group).map((x) => x.id);
    const allOn = ids.every((id) => topics.includes(id));
    set({ topics: allOn ? topics.filter((x) => !ids.includes(x)) : [...new Set([...topics, ...ids])] });
  };
  const toggleDay = (d: string) => set({ days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] });
  const dayList = [...dayCounts.keys()].sort();
  const isDefault =
    filter.dateKey === 'today' && !days.length && topics.length === TOPIC_IDS.length && scope === 'all' && !q;
  const loaded = scope === 'linked' || p.pool !== undefined;

  return (
    <section className="flow">
      <div className="section-title">Timeline</div>

      <div className="card tl-filter">
        <div className="tl-row">
          <div className="tl-label">Dates</div>
          <div className="tl-controls">
            <div className="chips">
              {DATE_CHOICES.map(([key, label]) => (
                <button
                  key={key}
                  className={'pill' + (filter.dateKey === key ? ' on' : '')}
                  onClick={() => setRange(key, dateRange(key, p.period))}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="tl-dates">
              <input
                type="date"
                className="date-input"
                aria-label="From"
                value={range.from}
                max={range.to}
                onChange={(e) => e.target.value && setRange('custom', { ...range, from: e.target.value })}
              />
              <span className="muted">→</span>
              <input
                type="date"
                className="date-input"
                aria-label="To"
                value={range.to}
                min={range.from}
                onChange={(e) => e.target.value && setRange('custom', { ...range, to: e.target.value })}
              />
            </div>
            {range.from !== range.to && dayList.length > 1 && (
              <div className="chips tl-days">
                <span className="tl-hint">Pick days</span>
                {dayList.map((d) => (
                  <button
                    key={d}
                    className={'tl-chip' + (days.includes(d) ? ' on' : '')}
                    aria-pressed={days.includes(d)}
                    onClick={() => toggleDay(d)}
                  >
                    {fmtDate(d, true)} <span className="n">{dayCounts.get(d)}</span>
                  </button>
                ))}
                {days.length > 0 && (
                  <button className="link" onClick={() => set({ days: [] })}>
                    All days
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="tl-row">
          <div className="tl-label">
            Topics
            <span className="tl-links">
              <button className="link" onClick={() => set({ topics: TOPIC_IDS })}>
                All
              </button>
              <button className="link" onClick={() => set({ topics: [] })}>
                None
              </button>
            </span>
          </div>
          <div className="tl-controls">
            {GROUPS.map(([group, label]) => {
              const ids = TOPICS.filter((x) => x.group === group);
              const on = ids.filter((x) => topics.includes(x.id)).length;
              return (
                <div key={group} className="tl-group">
                  <button
                    className={'tl-group-name' + (on === ids.length ? ' on' : on ? ' some' : '')}
                    aria-pressed={on === ids.length}
                    onClick={() => toggleGroup(group)}
                  >
                    <span className="box" />
                    {label}
                  </button>
                  <div className="chips">
                    {ids.map((x) => (
                      <button
                        key={x.id}
                        className={'tl-chip' + (topics.includes(x.id) ? ' on' : '')}
                        aria-pressed={topics.includes(x.id)}
                        onClick={() => toggleTopic(x.id)}
                      >
                        {x.name} <span className="n">{topicCounts[x.id] ?? 0}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="tl-row">
          <div className="tl-label">Show</div>
          <div className="tl-controls tl-inline">
            <div className="segmented">
              <button className={scope === 'all' ? 'on' : ''} onClick={() => set({ scope: 'all' })}>
                All events
              </button>
              <button className={scope === 'linked' ? 'on' : ''} onClick={() => set({ scope: 'linked' })}>
                Linked to this story
              </button>
            </div>
            <input
              className="tl-search"
              value={query}
              onChange={(e) => set({ query: e.target.value })}
              placeholder="Search titles…"
              aria-label="Search events"
            />
          </div>
        </div>

        <div className="tl-summary">
          <span>
            {plural(shown.length, 'event')} · {plural(clippings, 'clipping')} ·{' '}
            {range.from === range.to ? fmtDate(range.from) : rangeLabel(range.from, range.to)}
            {days.length > 0 && ` (${plural(days.length, 'day')} picked)`}
          </span>
          {!isDefault && (
            <button className="link" onClick={() => setFilter(todayOnly())}>
              Reset to today
            </button>
          )}
        </div>
      </div>

      {scope === 'all' && p.poolStatus === 'error' && <div className="notice">Couldn’t load events: {p.poolError}</div>}
      {!loaded && p.poolStatus === 'loading' && <div className="loading">Loading events…</div>}
      {loaded && !shown.length && (
        <div className="empty tl-empty">
          <div className="big">No events match these filters.</div>
          <div className="small">
            {filter.dateKey === 'today' && 'Today’s edition may not be in yet. '}
            <button className="link" onClick={() => setRange('7', dateRange('7', p.period))}>
              Show the last 7 days
            </button>
          </div>
        </div>
      )}

      {byDate.map(([date, list]) => (
        <div key={date} className="tl-day">
          <div className="tl-day-head">
            {fmtDate(date)} <span className="muted">· {plural(list.length, 'event')}</span>
          </div>
          {list.map((e) => {
            const link = links.get(e.id);
            return (
              <button
                key={e.id}
                className={'flow-card' + (link?.kind === 'self' ? ' self' : '')}
                onClick={() => p.onOpenEvent(e.id)}
              >
                <div className="tagrow">
                  {link && (
                    <span className="kind" style={{ color: LINK_STYLE[link.kind].color }}>
                      {LINK_STYLE[link.kind].label}
                    </span>
                  )}
                  <Tags topics={e.topics} />
                </div>
                <div className="title">{e.title}</div>
                <div className="reason">{link && link.kind !== 'self' ? link.reason : e.dek}</div>
                <div className="meta">
                  {plural(e.clippingCount, 'clipping')} · {plural(e.paperCount, 'paper')}
                </div>
              </button>
            );
          })}
        </div>
      ))}
      {p.children}
    </section>
  );
}
