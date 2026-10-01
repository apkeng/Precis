import type { Period, Quiz } from '../api';
import { rangeLabel } from '../lib/dates';
import { TOPICS_BY_ID } from '../topics';
import type { QuizState } from './QuizRun';

interface Props {
  period: Period;
  state: QuizState;
  onRetry: (quiz: Quiz) => void;
  onNew: () => void;
  onOpenEvent: (id: string) => void;
}

export function Results({ period, state, onRetry, onNew, onOpenEvent }: Props) {
  const { quiz, answers } = state;
  const questions = quiz.questions;
  const score = answers.filter((a) => a.ok).length;
  const pct = questions.length ? score / questions.length : 0;
  const line =
    pct >= 0.8
      ? 'Strong grip on this period.'
      : pct >= 0.5
        ? 'Solid — revisit the topics marked below.'
        : 'Worth another read of the events below.';

  const byTopic = new Map<string, { correct: number; total: number }>();
  questions.forEach((q, i) => {
    const t = byTopic.get(q.topic) ?? { correct: 0, total: 0 };
    t.total++;
    if (answers[i]?.ok) t.correct++;
    byTopic.set(q.topic, t);
  });

  const retry = () => {
    const wrong = questions.filter((_, i) => !answers[i]?.ok);
    const retryQuestions = wrong.length ? wrong : questions;
    onRetry({ questions: retryQuestions, requested: retryQuestions.length });
  };

  return (
    <main className="results">
      <div className="results-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="eyebrow accent">Result · {rangeLabel(period.from, period.to)}</div>
          <div className="score">
            <span className="v">{score}</span>
            <span className="of">/ {questions.length}</span>
          </div>
          <div className="score-line">{line}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn dark" onClick={retry}>
              Retry wrong answers
            </button>
            <button className="btn outline" onClick={onNew}>
              New quiz
            </button>
          </div>
        </div>
        <div className="by-topic">
          <div className="eyebrow">By topic</div>
          {[...byTopic].map(([topic, { correct, total }]) => (
            <div key={topic} className="row">
              <div className="top">
                <span>{TOPICS_BY_ID[topic]?.name ?? topic}</span>
                <span className="muted">
                  {correct}/{total}
                </span>
              </div>
              <span className="bar-track">
                <span
                  style={{
                    width: `${(correct / total) * 100}%`,
                    background: correct === total ? 'var(--ok)' : correct ? 'var(--accent)' : 'var(--bad)',
                  }}
                />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="section-title" style={{ fontSize: 24, paddingBottom: 10 }}>
          Review
        </div>
        {questions.map((q, i) => {
          const a = answers[i];
          return (
            <div key={q.id} className="review-row">
              <span className="meta" style={{ fontSize: 13 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="body">
                <div className="stem">{q.stem.split('\n')[0]}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                  Answer: <strong>{q.options[q.answer]}</strong> · You: {a ? q.options[a.picked] : '—'}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink-3)' }}>{q.explanation}</div>
                <button
                  className="link"
                  style={{ fontSize: 12, alignSelf: 'flex-start' }}
                  onClick={() => onOpenEvent(q.eventId)}
                >
                  {q.eventTitle.split(';')[0]} →
                </button>
              </div>
              <span className={'status ' + (a?.ok ? 'ok' : 'bad')}>{a?.ok ? 'Correct' : 'Incorrect'}</span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
