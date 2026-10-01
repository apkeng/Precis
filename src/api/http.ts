import { TOPIC_IDS } from '../topics';
import type {
  AskAnswer,
  EventDetail,
  EventList,
  IndexStats,
  Period,
  PrecisApi,
  Quiz,
  QuizRequest,
  Trace,
} from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** PrecisApi backed by precis-backend at `baseUrl`. */
export function httpApi(baseUrl: string): PrecisApi {
  const base = baseUrl.replace(/\/+$/, '');

  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(base + path, {
        ...init,
        headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      });
    } catch {
      throw new ApiError(0, `Couldn't reach the Précis backend at ${base}.`);
    }
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        if (typeof body.detail === 'string') detail = body.detail;
      } catch {
        // keep statusText
      }
      throw new ApiError(res.status, detail);
    }
    return res.json() as Promise<T>;
  }

  const range = (p: Period) => `from=${p.from}&to=${p.to}`;
  const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

  return {
    listEvents(period, topics) {
      // All topics is the same as no filter; an empty selection must still
      // be sent, as an empty list.
      const all = TOPIC_IDS.every((t) => topics.includes(t));
      const filter = all ? '' : `&topics=${encodeURIComponent(topics.join(','))}`;
      return call<EventList>(`/events?${range(period)}${filter}`);
    },
    getEvent: (id) => call<EventDetail>(`/events/${encodeURIComponent(id)}`),
    ask: (id, question, period) =>
      call<AskAnswer>(`/events/${encodeURIComponent(id)}/ask`, post({ question, ...period })),
    trace: (id, period) => call<Trace>(`/events/${encodeURIComponent(id)}/trace?${range(period)}`),
    eventQuiz: (id) => call<Quiz>(`/events/${encodeURIComponent(id)}/quiz`),
    createQuiz: (request: QuizRequest) => call<Quiz>('/quizzes', post(request)),
    stats: () => call<IndexStats>('/stats'),
  };
}
