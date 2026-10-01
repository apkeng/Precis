// The contract between the Précis UI and its data source. `httpApi` talks to
// precis-backend; `mockApi` serves the design's sample data. Screens only
// ever see `PrecisApi`.

import type { Difficulty, QuestionFormat } from '../topics';

/** ISO date, YYYY-MM-DD. */
export type IsoDate = string;

export interface Period {
  from: IsoDate;
  to: IsoDate;
}

export interface EventSummary {
  id: string;
  date: IsoDate;
  title: string;
  dek: string;
  topics: string[];
  clippingCount: number;
  paperCount: number;
}

export interface EventList {
  events: EventSummary[];
  clippingCount: number;
  /** Events per topic across the whole period, ignoring the topic filter. */
  topicCounts: Record<string, number>;
}

export interface Source {
  /** 1-based number that `[n]` citations in the analysis refer to. */
  n: number;
  id: string;
  paper: string;
  date: IsoDate;
  page: number | null;
  title: string;
  excerpt: string;
}

export interface Analysis {
  /** Text with inline `[n]` citations. */
  whatHappened: string;
  whyItMatters: string;
  prelimsFacts: string[];
  gsPaper: string;
  mainsQuestion: string;
  timeline: { date: string; text: string }[];
}

export interface EventDetail extends EventSummary {
  sources: Source[];
  analysis: Analysis;
}

export interface AskAnswer {
  question: string;
  answer: string;
  foundInSources: boolean;
  sources: { n: number; paper: string; date: IsoDate; title: string }[];
}

export type RelationKind = 'direct' | 'theme';

export interface RelatedEvent {
  event: EventSummary;
  kind: RelationKind;
  reason: string;
}

export interface CoverageDay {
  date: IsoDate;
  /** Clippings on the story itself that day. */
  story: number;
  /** Clippings on its related events that day. */
  related: number;
}

export type Tone = 'Explanatory' | 'Critical' | 'Neutral';

export interface Framing {
  paper: string;
  angle: string;
  tone: Tone;
  clippingCount: number;
}

export interface Trace {
  event: EventSummary;
  days: CoverageDay[];
  related: RelatedEvent[];
  /** Directly linked events dated outside the period. */
  outsideCount: number;
  /** The period widened to include them, or null. */
  outsideRange: Period | null;
  framing: Framing[];
}

export interface Question {
  id: string;
  eventId: string;
  eventTitle: string;
  topic: string;
  type: QuestionFormat;
  stem: string;
  statements: string[];
  options: string[];
  /** Index of the correct option. */
  answer: number;
  explanation: string;
  source: { paper: string; date: IsoDate; title: string };
}

export interface Quiz {
  questions: Question[];
  /** How many were asked for; fewer come back when the material runs out. */
  requested: number;
}

export interface QuizRequest extends Period {
  topics: string[];
  formats: QuestionFormat[];
  length: number;
  difficulty: Difficulty;
  /** Limit to these events (the story-thread quiz). */
  eventIds?: string[];
}

export interface IndexStats {
  papers: number;
  clippingsThisMonth: number;
  refreshedAt: string | null;
}

export interface PrecisApi {
  listEvents(period: Period, topics: string[]): Promise<EventList>;
  getEvent(id: string): Promise<EventDetail>;
  ask(id: string, question: string, period: Period): Promise<AskAnswer>;
  trace(id: string, period: Period): Promise<Trace>;
  eventQuiz(id: string): Promise<Quiz>;
  createQuiz(request: QuizRequest): Promise<Quiz>;
  stats(): Promise<IndexStats>;
}
