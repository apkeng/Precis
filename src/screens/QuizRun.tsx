import type { Quiz } from '../api';
import { fmtDate } from '../lib/dates';
import { TOPICS_BY_ID } from '../topics';

export interface QuizState {
  quiz: Quiz;
  qi: number;
  picked: number | null;
  revealed: boolean;
  answers: { ok: boolean; picked: number }[];
}

interface Props {
  state: QuizState;
  setState: (s: QuizState) => void;
  onExit: () => void;
  onFinish: () => void;
  onOpenEvent: (id: string) => void;
}

const LETTERS = 'abcd';

export function QuizRun({ state, setState, onExit, onFinish, onOpenEvent }: Props) {
  const { quiz, qi, picked, revealed, answers } = state;
  const q = quiz.questions[qi];
  const total = quiz.questions.length;
  const last = qi === total - 1;
  const correct = picked === q.answer;

  const primary = () => {
    if (picked === null) return;
    if (!revealed) {
      setState({ ...state, revealed: true, answers: [...answers, { ok: correct, picked }] });
    } else if (last) {
      onFinish();
    } else {
      setState({ ...state, qi: qi + 1, picked: null, revealed: false });
    }
  };

  const optionClass = (i: number) => {
    if (revealed) return i === q.answer ? ' correct' : i === picked ? ' wrong' : '';
    return i === picked ? ' picked' : '';
  };

  return (
    <main className="quiz">
      <div className="quiz-progress">
        <div className="top">
          <span>
            Question {qi + 1} of {total}
            {total < quiz.requested && (
              <span> · {quiz.requested} requested, {total} could be grounded in sources</span>
            )}
          </span>
          <button className="link" onClick={onExit}>
            Exit quiz
          </button>
        </div>
        <div className="dots">
          {quiz.questions.map((_, i) => (
            <span
              key={i}
              style={{
                background:
                  i < qi ? (answers[i]?.ok ? 'var(--ok)' : 'var(--bad)') : i === qi ? 'var(--accent)' : 'var(--line-strong)',
              }}
            />
          ))}
        </div>
      </div>

      <div className="tagrow">
        <span className="eyebrow accent">{q.type}</span>
        <span className="tag lg">{TOPICS_BY_ID[q.topic]?.name ?? q.topic}</span>
      </div>
      <h1>{q.stem}</h1>
      {q.statements.length > 0 && (
        <ol className="statements">
          {q.statements.map((s, i) => (
            <li key={i}>
              <span className="n">{q.type === 'Match' ? '' : `${i + 1}.`}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="options">
        {q.options.map((o, i) => (
          <button
            key={i}
            className={'option' + optionClass(i)}
            onClick={() => !revealed && setState({ ...state, picked: i })}
            aria-pressed={picked === i}
          >
            <span className="letter">{LETTERS[i]}</span>
            <span>{o}</span>
            <span className="mark">
              {revealed && i === q.answer ? 'Correct' : revealed && i === picked ? 'Your answer' : ''}
            </span>
          </button>
        ))}
      </div>

      {revealed && (
        <div className="card explain">
          <div className={'verdict ' + (correct ? 'ok' : 'bad')}>{correct ? 'Correct.' : 'Not quite.'}</div>
          <div className="text">{q.explanation}</div>
          <div className="meta" style={{ fontSize: 12 }}>
            Source: {q.source.paper}, {fmtDate(q.source.date, true)} — “{q.source.title}” ·{' '}
            <button className="link" onClick={() => onOpenEvent(q.eventId)}>
              open event
            </button>
          </div>
        </div>
      )}

      <div className="quiz-actions">
        <button className="btn primary" onClick={primary} disabled={picked === null}>
          {!revealed ? 'Check answer' : last ? 'See results' : 'Next question'}
        </button>
      </div>
    </main>
  );
}
