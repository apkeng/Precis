import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { EventList, Period, Quiz } from '../api';
import { rangeLabel } from '../lib/dates';
import { errorMessage, type Async } from '../lib/useAsync';
import { DIFFICULTIES, FORMATS, TOPICS, TOPIC_IDS, type Difficulty, type QuestionFormat } from '../topics';

export interface QuizSettings {
  formats: QuestionFormat[];
  length: number;
  difficulty: Difficulty;
}

interface Props {
  period: Period;
  events: Async<EventList>;
  selected: string[];
  setSelected: (ids: string[]) => void;
  settings: QuizSettings;
  setSettings: (s: QuizSettings) => void;
  onStart: (quiz: Quiz) => void;
}

const LENGTHS = [5, 10, 20];
const STEPS = ['Retrieving clippings in range', 'Drafting questions with the model', 'Verifying answers against sources'];

export function QuizSetup({ period, events, selected, setSelected, settings, setSettings, onStart }: Props) {
  const [step, setStep] = useState<number | null>(null); // generation progress, null when idle
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const list = events.data;
  const eventCount = list?.events.length ?? 0;
  const generating = step !== null;
  const canGenerate = eventCount > 0 && selected.length > 0 && settings.formats.length > 0 && !generating;

  const toggleTopic = (id: string) =>
    setSelected(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id]);
  const toggleFormat = (id: QuestionFormat) =>
    setSettings({
      ...settings,
      formats: settings.formats.includes(id) ? settings.formats.filter((f) => f !== id) : [...settings.formats, id],
    });

  const note = !eventCount
    ? 'No events in this period match the selected topics. Widen the period or add topics.'
    : !settings.formats.length
      ? 'Pick at least one question format.'
      : `Up to ${settings.length} questions, each traceable to a specific clipping. If the period can’t support that many, the quiz comes out shorter rather than padded.`;

  const generate = async () => {
    if (!canGenerate) return;
    setError(null);
    setStep(0);
    // The steps advance on a timer for feedback; the last one waits for the API.
    timers.current = [1, 2].map((k) => window.setTimeout(() => setStep(k), k * 550));
    try {
      const quiz = await api.createQuiz({ ...period, topics: selected, ...settings });
      if (!quiz.questions.length) {
        setError('No questions could be grounded in sources for this selection. Widen the period or add topics or formats.');
      } else {
        setStep(3);
        onStart(quiz);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      timers.current.forEach(clearTimeout);
      setStep(null);
    }
  };

  return (
    <main className="setup">
      <div className="setup-main">
        <div className="page-head">
          <div className="eyebrow accent">New quiz</div>
          <h1>Test yourself on {rangeLabel(period.from, period.to)}</h1>
          <div className="sub">Change the period in the bar above. Topic selection carries over from Explore.</div>
        </div>

        <div className="field">
          <div className="field-head">
            <div className="field-title">Topics</div>
            <div className="rail-links" style={{ gap: 12 }}>
              <button className="link" onClick={() => setSelected(TOPIC_IDS)}>
                All
              </button>
              <button className="link" onClick={() => setSelected([])}>
                None
              </button>
            </div>
          </div>
          <div className="chips">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                className={'pill lg' + (selected.includes(t.id) ? ' on' : '')}
                aria-pressed={selected.includes(t.id)}
                onClick={() => toggleTopic(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="field-title">Question formats</div>
          <div className="formats">
            {FORMATS.map((f) => {
              const on = settings.formats.includes(f.id);
              return (
                <button key={f.id} className={'format' + (on ? ' on' : '')} aria-pressed={on} onClick={() => toggleFormat(f.id)}>
                  <span className="name">
                    {on ? '✓ ' : ''}
                    {f.name}
                  </span>
                  <span className="desc">{f.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="setup-row">
          <div className="field">
            <div className="field-title">Length</div>
            <div className="segmented">
              {LENGTHS.map((n) => (
                <button
                  key={n}
                  className={settings.length === n ? 'on' : ''}
                  onClick={() => setSettings({ ...settings, length: n })}
                >
                  {n} questions
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <div className="field-title">Difficulty</div>
            <div className="segmented">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  className={settings.difficulty === d ? 'on' : ''}
                  onClick={() => setSettings({ ...settings, difficulty: d })}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <aside className="setup-card">
        <div className="eyebrow">Will be drawn from</div>
        <div className="figures">
          <div className="figure">
            <div className="v">{eventCount}</div>
            <div className="k">events</div>
          </div>
          <div className="figure">
            <div className="v">{list?.clippingCount ?? 0}</div>
            <div className="k">clippings</div>
          </div>
        </div>
        <div className="setup-note">{note}</div>
        {generating && (
          <div className="gen-steps">
            {STEPS.map((s, i) => (
              <div key={s} style={{ opacity: i <= step ? 1 : 0.4 }}>
                <span>{i < step ? '✓' : '·'}</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}
        {error && <div className="error">{error}</div>}
        <button
          className="btn primary"
          onClick={generate}
          disabled={!canGenerate}
          style={generating ? { background: 'var(--accent)' } : undefined}
        >
          {generating ? 'Generating…' : 'Generate quiz'}
        </button>
      </aside>
    </main>
  );
}
