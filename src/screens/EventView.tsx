import { useState, type ReactNode } from 'react';
import { api } from '../api';
import type { AskAnswer, Period, Quiz } from '../api';
import { Cited } from '../components/Cited';
import { Tags } from '../components/Tags';
import { fmtDate, rangeLabel } from '../lib/dates';
import { errorMessage, useAsync } from '../lib/useAsync';

interface Props {
  eventId: string;
  period: Period;
  answers: AskAnswer[];
  onAnswer: (a: AskAnswer) => void;
  onBack: () => void;
  onTrace: () => void;
  onQuiz: (quiz: Quiz) => void;
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="labelled">
      <h2>{label}</h2>
      {children}
    </section>
  );
}

export function EventView({ eventId, period, answers, onAnswer, onBack, onTrace, onQuiz }: Props) {
  const event = useAsync(() => api.getEvent(eventId), [eventId]);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [practice, setPractice] = useState<'idle' | 'loading' | 'empty' | string>('idle');
  const range = rangeLabel(period.from, period.to);

  const submitAsk = async () => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setAskError(null);
    try {
      onAnswer(await api.ask(eventId, q, period));
      setQuestion('');
    } catch (err) {
      setAskError(errorMessage(err));
    } finally {
      setAsking(false);
    }
  };

  const startPractice = async () => {
    setPractice('loading');
    try {
      const quiz = await api.eventQuiz(eventId);
      if (quiz.questions.length) {
        setPractice('idle');
        onQuiz(quiz);
      } else setPractice('empty');
    } catch (err) {
      setPractice(errorMessage(err));
    }
  };

  const e = event.data?.id === eventId ? event.data : undefined;
  return (
    <main className="page">
      <button className="back" onClick={onBack}>
        ← Back to {range}
      </button>
      {event.status === 'error' && <div className="notice">Couldn’t load this event: {event.error}</div>}
      {!e && event.status === 'loading' && <div className="loading">Reading the clippings…</div>}
      {e && (
        <div className="event-layout">
          <article className="event-main">
            <div className="event-head">
              <div className="tagrow">
                <span className="eyebrow accent">{fmtDate(e.date)}</span>
                <Tags topics={e.topics} large full />
              </div>
              <h1>{e.title}</h1>
              <p className="dek">{e.dek}</p>
              <div className="grounding">
                <span className="dot" />
                <span>AI analysis grounded in {e.sources.length} clippings · every claim cites its source</span>
              </div>
              <button className="trace-cta" onClick={onTrace}>
                <span className="main">Analyse this story across {range} →</span>
                {/* The design showed the related-event count here; with the real backend
                    that would run the story analysis on every event open, so it's left out. */}
                <span className="sub">How coverage evolved, and related events in the period</span>
              </button>
            </div>

            <Labelled label="What happened">
              <p className="prose">
                <Cited text={e.analysis.whatHappened} onCite={setHighlight} />
              </p>
            </Labelled>
            <Labelled label="Why it matters">
              <p className="prose">
                <Cited text={e.analysis.whyItMatters} onCite={setHighlight} />
              </p>
            </Labelled>
            <Labelled label="Prelims facts">
              <ol className="facts">
                {e.analysis.prelimsFacts.map((f, i) => (
                  <li key={i}>
                    <span className="num">{String(i + 1).padStart(2, '0')}</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ol>
            </Labelled>
            <Labelled label="Mains angle">
              <div className="card mains">
                <div className="meta">{e.analysis.gsPaper}</div>
                <div className="q">“{e.analysis.mainsQuestion}”</div>
              </div>
            </Labelled>
            <Labelled label="Ask the sources">
              <div className="ask">
                <div className="ask-box">
                  <input
                    value={question}
                    onChange={(ev) => setQuestion(ev.target.value)}
                    onKeyDown={(ev) => ev.key === 'Enter' && submitAsk()}
                    placeholder="e.g. How does this compare with earlier rulings?"
                    aria-label="Ask the sources"
                  />
                  <button onClick={submitAsk} disabled={asking}>
                    {asking ? 'Asking…' : 'Ask'}
                  </button>
                </div>
                {askError && <div className="error">{askError}</div>}
                {answers.map((a, i) => (
                  <div key={i} className="card answer">
                    <div className="q">{a.question}</div>
                    <div className="a">{a.answer}</div>
                    {a.sources.length > 0 && (
                      <div className="srcs">
                        {a.sources.map((s) => `[${s.n}] ${s.paper}, ${fmtDate(s.date, true)}`).join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Labelled>
          </article>

          <aside className="event-side">
            <div>
              <div className="eyebrow ruled">Source clippings</div>
              {e.sources.map((s) => (
                <div key={s.id} className={'source' + (highlight === s.n ? ' hl' : '')}>
                  <span className="num">[{s.n}]</span>
                  <div className="body">
                    <div className="meta">
                      {s.paper} · {fmtDate(s.date, true)}
                      {s.page ? ` · p.${s.page}` : ''}
                    </div>
                    <div className="title">{s.title}</div>
                    <div className="excerpt">“{s.excerpt}”</div>
                  </div>
                </div>
              ))}
            </div>
            {e.analysis.timeline.length > 0 && (
              <div>
                <div className="eyebrow ruled">Timeline</div>
                {e.analysis.timeline.map((t, i) => (
                  <div key={i} className="timeline-row">
                    <span className="d">{t.date}</span>
                    <span>{t.text}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="rose-panel">
              <div className="title">Practice this event</div>
              <div className="note">
                {practice === 'empty'
                  ? 'No questions could be grounded in these clippings.'
                  : practice !== 'idle' && practice !== 'loading'
                    ? `Couldn’t draft questions: ${practice}`
                    : 'A short quiz drafted from these clippings.'}
              </div>
              <button className="btn primary sm" onClick={startPractice} disabled={practice === 'loading'}>
                {practice === 'loading' ? 'Drafting questions…' : 'Start quick quiz →'}
              </button>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
