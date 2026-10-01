// PrecisApi over the prototype's sample data, with the prototype's logic:
// related events from fixed links plus shared topics, a synthetic coverage
// curve, and quizzes cut from a fixed question bank. Used when no backend
// URL is configured.

import { addDays, dayDiff } from '../lib/dates';
import { TOPICS_BY_ID } from '../topics';
import { EVENTS, LINKS, PAPERS, QUESTIONS, type MockEvent, type MockQuestion } from './mockData';
import type {
  EventDetail,
  EventSummary,
  Period,
  PrecisApi,
  Question,
  Quiz,
  RelatedEvent,
  Source,
  Tone,
  Trace,
} from './types';

/** The date the sample data treats as today. */
export const MOCK_TODAY = '2026-09-30';

const strip = (s: string) => s.replace(/\s*\[\d\]/g, '');
const headline = (title: string) => title.split(';')[0];

function sourcesOf(e: MockEvent, i: number): Source[] {
  const EXC = ['Officials said the response drew on lessons from previous storms.', 'The judgment ran to over 300 pages.', 'Experts noted the significance for the coming year.'];
  return [0, 1, 2].map((k) => ({
    n: k + 1,
    id: `${e.id}-s${k + 1}`,
    paper: PAPERS[(i + k) % 3],
    date: e.date,
    page: ((i * 7 + k * 3) % 14) + 1,
    title: k === 0 ? headline(e.title).split(',')[0] : k === 1 ? 'What the decision means' : 'Analysis: the wider picture',
    excerpt:
      k === 0
        ? strip(e.what).split('. ')[0] + '.'
        : k === 1
          ? strip(e.what).split('. ').slice(1).join('. ') || EXC[k]
          : strip(e.why).split('. ')[0] + '.',
  }));
}

const SOURCES = new Map(EVENTS.map((e, i) => [e.id, sourcesOf(e, i)]));

function summary(e: MockEvent): EventSummary {
  const sources = SOURCES.get(e.id)!;
  return {
    id: e.id,
    date: e.date,
    title: e.title,
    dek: e.dek,
    topics: e.topics,
    clippingCount: sources.length,
    paperCount: new Set(sources.map((s) => s.paper)).size,
  };
}

function find(id: string): MockEvent {
  const e = EVENTS.find((x) => x.id === id);
  if (!e) throw new Error(`No event with id ${id}.`);
  return e;
}

const inPeriod = (e: { date: string }, p: Period) => e.date >= p.from && e.date <= p.to;
const newestFirst = (a: MockEvent, b: MockEvent) => (a.date < b.date ? 1 : -1);

function question(q: MockQuestion, i: number): Question {
  const e = find(q.ev);
  const src = SOURCES.get(e.id)![0];
  return {
    id: `${q.ev}-q${i}`,
    eventId: e.id,
    eventTitle: e.title,
    topic: q.topic,
    type: q.type,
    stem: q.stem,
    statements: q.st ?? [],
    options: q.opts,
    answer: q.a,
    explanation: q.x,
    source: { paper: src.paper, date: e.date, title: headline(e.title) },
  };
}
const ALL_QUESTIONS = QUESTIONS.map(question);

function relatedOf(id: string): RelatedEvent[] {
  const e = find(id);
  const out: RelatedEvent[] = [];
  for (const [a, b, reason] of LINKS) {
    if (a === id || b === id) out.push({ event: summary(find(a === id ? b : a)), kind: 'direct', reason });
  }
  for (const x of EVENTS) {
    if (x.id === id || out.some((o) => o.event.id === x.id)) continue;
    const shared = x.topics.find((t) => e.topics.includes(t));
    if (shared) out.push({ event: summary(x), kind: 'theme', reason: `Shares the ${TOPICS_BY_ID[shared].name} thread` });
  }
  return out;
}

const TONES: Tone[] = ['Explanatory', 'Critical', 'Neutral'];

function trace(id: string, period: Period): Trace {
  const e = find(id);
  const relAll = relatedOf(id);
  const rel = relAll.filter((r) => inPeriod(r.event, period));
  const n = Math.min(120, dayDiff(period.to, period.from) + 1);
  const days = [];
  for (let i = 0; i < n; i++) {
    const d = addDays(period.from, i);
    const off = dayDiff(d, e.date);
    let m = off < 0 ? (off > -6 ? 3 * Math.exp(off / 2) : 0) : 9 * Math.exp(-off / 4) + (off === 0 ? 5 : 0);
    m = Math.round(m + ((i * 7 + e.id.length) % 3 === 0 && m > 0.6 ? 1 : 0));
    let r = 0;
    for (const x of rel) {
      const o = dayDiff(d, x.event.date);
      if (o >= 0 && o < 4) r += (x.kind === 'direct' ? 4 : 2) * Math.exp(-o / 1.4);
    }
    days.push({ date: d, story: m, related: Math.round(r) });
  }
  const total = days.reduce((a, x) => a + x.story, 0);
  const outside = relAll.filter((r) => !inPeriod(r.event, period));
  const outsideDates = [period.from, period.to, ...outside.map((r) => r.event.date)].sort();
  return {
    event: summary(e),
    days,
    related: rel,
    outsideCount: outside.length,
    outsideRange: outside.length ? { from: outsideDates[0], to: outsideDates[outsideDates.length - 1] } : null,
    framing: SOURCES.get(id)!.map((s, i) => ({
      paper: s.paper,
      angle: s.title,
      tone: TONES[i % 3],
      clippingCount: Math.max(1, Math.round(total / 3) + (i === 0 ? 2 : -i)),
    })),
  };
}

const delay = <T>(value: () => T, ms = 120): Promise<T> =>
  new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(value());
      } catch (err) {
        reject(err);
      }
    }, ms),
  );

export const mockApi: PrecisApi = {
  listEvents(period, topics) {
    return delay(() => {
      const inRange = EVENTS.filter((e) => inPeriod(e, period)).sort(newestFirst);
      const events = inRange.filter((e) => e.topics.some((t) => topics.includes(t))).map(summary);
      const topicCounts: Record<string, number> = {};
      for (const e of inRange) for (const t of e.topics) topicCounts[t] = (topicCounts[t] ?? 0) + 1;
      return { events, clippingCount: events.reduce((n, e) => n + e.clippingCount, 0), topicCounts };
    });
  },

  getEvent(id) {
    return delay((): EventDetail => {
      const e = find(id);
      return {
        ...summary(e),
        sources: SOURCES.get(id)!,
        analysis: {
          whatHappened: e.what,
          whyItMatters: e.why,
          prelimsFacts: e.facts,
          gsPaper: e.paper,
          mainsQuestion: e.mains,
          timeline: e.timeline.map(([date, text]) => ({ date, text })),
        },
      };
    });
  },

  ask(id, question) {
    return delay(() => {
      const e = find(id);
      const sources = SOURCES.get(id)!;
      return {
        question,
        answer: `From the clippings: ${e.why} The sources in this period don’t go further than this; widen the date range to retrieve earlier coverage.`,
        foundInSources: true,
        sources: sources.map((s) => ({ n: s.n, paper: s.paper, date: s.date, title: s.title })),
      };
    }, 600);
  },

  trace: (id, period) => delay(() => trace(id, period)),

  eventQuiz(id) {
    return delay((): Quiz => {
      const questions = ALL_QUESTIONS.filter((q) => q.eventId === id);
      return { questions, requested: 3 };
    });
  },

  createQuiz(req) {
    return delay((): Quiz => {
      const ids = new Set(
        EVENTS.filter((e) => inPeriod(e, req) && e.topics.some((t) => req.topics.includes(t)))
          .filter((e) => !req.eventIds || req.eventIds.includes(e.id))
          .map((e) => e.id),
      );
      const questions = ALL_QUESTIONS.filter(
        (q) => ids.has(q.eventId) && req.topics.includes(q.topic) && req.formats.includes(q.type),
      ).slice(0, req.length);
      return { questions, requested: req.length };
    }, 1900);
  },

  stats: () => delay(() => ({ papers: PAPERS.length, clippingsThisMonth: 412, refreshedAt: `${MOCK_TODAY}T00:30:00Z` })),
};

