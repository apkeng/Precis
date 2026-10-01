import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDays, dayDiff, fmtDate } from '../lib/dates';
import { presets } from '../lib/presets';
import { TOPIC_IDS } from '../topics';
import { ApiError, httpApi } from './http';
import { MOCK_TODAY, mockApi } from './mock';

const SEP = { from: '2026-09-01', to: '2026-09-30' };

describe('dates', () => {
  it('formats and steps local dates without shifting a day', () => {
    expect(fmtDate('2026-09-01', true)).toBe('1 Sept');
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(dayDiff('2026-09-30', '2026-09-01')).toBe(29);
  });
});

describe('presets', () => {
  it('match the design against the sample data', () => {
    expect(presets(MOCK_TODAY).map((p) => [p.label, p.from, p.to])).toEqual([
      ['Last 7 days', '2026-09-24', '2026-09-30'],
      ['September', '2026-09-01', '2026-09-30'],
      ['Aug – Sep', '2026-08-01', '2026-09-30'],
      ['Last 90 days', '2026-07-03', '2026-09-30'],
    ]);
  });
});

describe('mockApi', () => {
  it('lists events in the period, newest first, filtered by topic', async () => {
    const all = await mockApi.listEvents(SEP, TOPIC_IDS);
    expect(all.events).toHaveLength(11); // e12 is dated 29 Aug
    expect(all.events[0].id).toBe('e1');
    expect(all.clippingCount).toBe(33);

    const geo = await mockApi.listEvents(SEP, ['geo']);
    expect(geo.events.map((e) => e.id)).toEqual(['e1', 'e10']);
    expect(geo.topicCounts.const).toBe(1); // counts ignore the topic filter
  });

  it('traces related events and counts those outside the period', async () => {
    const t = await mockApi.trace('e2', SEP);
    expect(t.days).toHaveLength(30);
    expect(t.related.filter((r) => r.kind === 'direct').map((r) => r.event.id)).toEqual(['e4']);
    expect(t.outsideCount).toBeGreaterThan(0); // e12, 29 Aug
    expect(t.outsideRange).toEqual({ from: '2026-08-29', to: '2026-09-30' });
  });

  it('cuts quizzes to the requested length and selection', async () => {
    const base = { ...SEP, topics: TOPIC_IDS, formats: ['MCQ' as const], difficulty: 'Mixed' as const };
    const quiz = await mockApi.createQuiz({ ...base, length: 3 });
    expect(quiz.questions).toHaveLength(3);
    expect(quiz.questions.every((q) => q.type === 'MCQ')).toBe(true);

    const thread = await mockApi.createQuiz({ ...base, length: 10, eventIds: ['e2'] });
    expect(thread.questions.map((q) => q.eventId)).toEqual(['e2']);
    expect(thread.requested).toBe(10);
  });
});

describe('httpApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(body: unknown, status = 200) {
    const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  it('omits the topic filter when every topic is selected, and sends an empty one for none', async () => {
    const fetch = stubFetch({ events: [], clippingCount: 0, topicCounts: {} });
    const api = httpApi('http://api.test/');
    await api.listEvents(SEP, TOPIC_IDS);
    await api.listEvents(SEP, []);
    await api.listEvents(SEP, ['geo', 'ir']);
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([
      'http://api.test/events?from=2026-09-01&to=2026-09-30',
      'http://api.test/events?from=2026-09-01&to=2026-09-30&topics=',
      'http://api.test/events?from=2026-09-01&to=2026-09-30&topics=geo%2Cir',
    ]);
  });

  it('posts JSON and surfaces the backend detail on errors', async () => {
    const fetch = stubFetch({ detail: 'No events in this period match the selected topics.' }, 409);
    const api = httpApi('http://api.test');
    const req = { ...SEP, topics: ['geo'], formats: ['MCQ' as const], length: 5, difficulty: 'Easy' as const };
    await expect(api.createQuiz(req)).rejects.toEqual(
      new ApiError(409, 'No events in this period match the selected topics.'),
    );
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('http://api.test/quizzes');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(req);
  });
});
