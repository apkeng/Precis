// The 14 syllabus topics, grouped by exam paper. Ids match the backend's
// app/topics.py.

export interface Topic {
  id: string;
  name: string;
  short: string;
  group: string;
}

export const TOPICS: Topic[] = (
  [
    ['natintl', 'National & International Events', 'Nat. & Intl.', 'Prelims'],
    ['econsoc', 'Economic & Social Development', 'Econ. & Social Dev.', 'Prelims'],
    ['ecology', 'Environmental Ecology', 'Ecology', 'Prelims'],
    ['polgov', 'Indian Polity & Governance', 'Polity & Gov.', 'Prelims'],
    ['gensci', 'General Science', 'Gen. Science', 'Prelims'],
    ['society', 'Indian Society', 'Society', 'GS I'],
    ['geo', 'Geography', 'Geography', 'GS I'],
    ['const', 'Polity & Constitution', 'Constitution', 'GS II'],
    ['socjust', 'Social Justice', 'Social Justice', 'GS II'],
    ['ir', 'International Relations', 'IR', 'GS II'],
    ['economy', 'Economy', 'Economy', 'GS III'],
    ['scitech', 'Science & Tech', 'Sci. & Tech', 'GS III'],
    ['envsec', 'Environment & Security', 'Env. & Security', 'GS III'],
    ['cases', 'Case Studies', 'Case Studies', 'GS IV'],
  ] as const
).map(([id, name, short, group]) => ({ id, name, short, group }));

export const TOPIC_IDS = TOPICS.map((t) => t.id);
export const TOPICS_BY_ID: Record<string, Topic> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

export const GROUPS: [group: string, label: string][] = [
  ['Prelims', 'Prelims'],
  ['GS I', 'GS I · Society & Geography'],
  ['GS II', 'GS II · Polity & IR'],
  ['GS III', 'GS III · Economy, Tech, Security'],
  ['GS IV', 'GS IV · Ethics'],
];

export type QuestionFormat = 'MCQ' | 'Statement' | 'Assertion–Reason' | 'Match';
export type Difficulty = 'Easy' | 'Mixed' | 'Hard';

export const FORMATS: { id: QuestionFormat; name: string; desc: string }[] = [
  { id: 'MCQ', name: 'MCQ', desc: 'Single correct answer' },
  { id: 'Statement', name: 'Statement-based', desc: '“Which of the above is/are correct?”' },
  { id: 'Assertion–Reason', name: 'Assertion–Reason', desc: 'Evaluate A and R' },
  { id: 'Match', name: 'Match the following', desc: 'Pair columns' },
];
export const FORMAT_IDS = FORMATS.map((f) => f.id);
export const DIFFICULTIES: Difficulty[] = ['Easy', 'Mixed', 'Hard'];
