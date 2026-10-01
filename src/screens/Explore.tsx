import { api } from '../api';
import type { EventList, EventSummary } from '../api';
import { Tags } from '../components/Tags';
import { fmtDate } from '../lib/dates';
import { useAsync, type Async } from '../lib/useAsync';
import { GROUPS, TOPICS, TOPIC_IDS } from '../topics';

interface Props {
  events: Async<EventList>;
  selected: string[];
  setSelected: (ids: string[]) => void;
  onOpen: (id: string) => void;
  onQuiz: () => void;
}

const srcLabel = (e: EventSummary) => `${e.clippingCount} clippings · ${e.paperCount} papers`;

export function Explore({ events, selected, setSelected, onOpen, onQuiz }: Props) {
  const list = events.data;
  const stats = useAsync(() => api.stats(), []);
  const toggle = (id: string) =>
    setSelected(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id]);

  const coverage = TOPICS.filter((t) => selected.includes(t.id))
    .map((t) => ({ ...t, count: list?.events.filter((e) => e.topics.includes(t.id)).length ?? 0 }))
    .filter((c) => c.count)
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);
  const maxCount = Math.max(1, ...coverage.map((c) => c.count));
  const [lead, ...rest] = list?.events ?? [];

  return (
    <main className="explore">
      <aside className="topics-rail">
        <div className="rail-head">
          <div className="eyebrow">Topics</div>
          <div className="rail-links">
            <button className="link" onClick={() => setSelected(TOPIC_IDS)}>
              All
            </button>
            <button className="link" onClick={() => setSelected([])}>
              None
            </button>
          </div>
        </div>
        {GROUPS.map(([group, label]) => (
          <div key={group} className="topic-group">
            <div className="topic-group-name">{label}</div>
            {TOPICS.filter((t) => t.group === group).map((t) => (
              <button
                key={t.id}
                className={'topic-toggle' + (selected.includes(t.id) ? ' on' : '')}
                aria-pressed={selected.includes(t.id)}
                onClick={() => toggle(t.id)}
              >
                <span className="box" />
                <span className="name">{t.name}</span>
                <span className="count">{list?.topicCounts[t.id] ?? 0}</span>
              </button>
            ))}
          </div>
        ))}
      </aside>

      <section className="stories">
        {events.status === 'error' && <div className="notice">Couldn’t load events: {events.error}</div>}
        {!list && events.status === 'loading' && <div className="loading">Loading coverage…</div>}
        {lead && (
          <>
            <article className="lead" onClick={() => onOpen(lead.id)}>
              <div className="tagrow">
                <span className="eyebrow accent">Lead · {fmtDate(lead.date)}</span>
                <Tags topics={lead.topics} large />
              </div>
              <h1>{lead.title}</h1>
              <p className="dek">{lead.dek}</p>
              <div className="meta">{srcLabel(lead)}</div>
            </article>
            <div className="story-grid">
              {rest.map((e) => (
                <article key={e.id} className="story" onClick={() => onOpen(e.id)}>
                  <div className="tagrow">
                    <span className="meta">{fmtDate(e.date)}</span>
                    <Tags topics={e.topics} />
                  </div>
                  <h3>{e.title}</h3>
                  <p>{e.dek}</p>
                  <div className="meta">{srcLabel(e)}</div>
                </article>
              ))}
            </div>
          </>
        )}
        {list && !lead && (
          <div className="empty">
            <div className="big">No coverage matches this period and topic set.</div>
            <div className="small">Widen the date range or re-enable topics on the left.</div>
          </div>
        )}
      </section>

      <aside className="side">
        <div className="rose-panel">
          <div className="eyebrow rose">Revise this period</div>
          <div className="title">Generate a quiz from {list?.events.length ?? 0} events</div>
          <div className="note">
            Questions are drafted only from ingested clippings in your range, each linked back to its source.
          </div>
          <button className="btn primary" style={{ marginTop: 4 }} onClick={onQuiz}>
            Set up quiz →
          </button>
        </div>
        <div className="coverage">
          <div className="eyebrow ruled">Coverage in period</div>
          {coverage.map((c) => (
            <div key={c.id} className="coverage-row">
              <div className="label">
                <span>{c.name}</span>
                <span className="bar-track">
                  <span style={{ width: `${(c.count / maxCount) * 100}%` }} />
                </span>
              </div>
              <span className="n">{c.count}</span>
            </div>
          ))}
        </div>
        {stats.data && (
          <div className="index-note">
            {stats.data.refreshedAt && `Index refreshed ${refreshedLabel(stats.data.refreshedAt)} · `}
            {stats.data.papers} newspaper{stats.data.papers === 1 ? '' : 's'} · {stats.data.clippingsThisMonth} clippings
            ingested this month
          </div>
        )}
      </aside>
    </main>
  );
}

function refreshedLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
