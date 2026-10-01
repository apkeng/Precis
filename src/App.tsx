import { useCallback, useState } from 'react';
import { api, referenceDate, usingSampleData } from './api';
import type { AskAnswer, Period, Quiz } from './api';
import { Explore } from './screens/Explore';
import { EventView } from './screens/EventView';
import { QuizRun, type QuizState } from './screens/QuizRun';
import { QuizSetup, type QuizSettings } from './screens/QuizSetup';
import { Results } from './screens/Results';
import { TraceView } from './screens/TraceView';
import { defaultPreset, presets } from './lib/presets';
import { useAsync } from './lib/useAsync';
import { FORMAT_IDS, TOPIC_IDS } from './topics';

export type View = 'explore' | 'event' | 'trace' | 'setup' | 'quiz' | 'results';

const NAV: [label: string, views: View[]][] = [
  ['Explore', ['explore', 'event', 'trace']],
  ['Quiz', ['setup', 'quiz', 'results']],
];

export default function App() {
  const initial = defaultPreset(referenceDate);
  const [view, setViewState] = useState<View>('explore');
  const [period, setPeriodState] = useState<Period>({ from: initial.from, to: initial.to });
  const [preset, setPreset] = useState<string | null>(initial.key);
  const [selected, setSelected] = useState<string[]>(TOPIC_IDS);
  const [eventId, setEventId] = useState<string | null>(null);
  const [settings, setSettings] = useState<QuizSettings>({
    formats: FORMAT_IDS,
    length: 10,
    difficulty: 'Mixed',
  });
  const [run, setRun] = useState<QuizState | null>(null);
  const [asks, setAsks] = useState<Record<string, AskAnswer[]>>({});

  const setView = useCallback((v: View) => {
    setViewState(v);
    window.scrollTo(0, 0);
  }, []);
  const setPeriod = (p: Period, key: string | null = null) => {
    setPeriodState(p);
    setPreset(key);
  };
  const openEvent = (id: string) => {
    setEventId(id);
    setView('event');
  };
  const startQuiz = (quiz: Quiz) => {
    setRun({ quiz, qi: 0, picked: null, revealed: false, answers: [] });
    setView('quiz');
  };

  const events = useAsync(() => api.listEvents(period, selected), [period.from, period.to, selected.join()]);
  const list = events.data;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand">
            <div className="brand-name">Précis</div>
            <div className="eyebrow">News analysis for civil services</div>
          </div>
          <nav className="nav">
            {NAV.map(([label, views]) => (
              <button
                key={label}
                className={views.includes(view) ? 'on' : ''}
                onClick={() => setView(views[0])}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="periodbar">
        <div className="periodbar-inner">
          <div className="eyebrow">Period</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="date"
              className="date-input"
              value={period.from}
              max={period.to}
              onChange={(e) => e.target.value && setPeriod({ ...period, from: e.target.value })}
            />
            <span className="muted">→</span>
            <input
              type="date"
              className="date-input"
              value={period.to}
              min={period.from}
              onChange={(e) => e.target.value && setPeriod({ ...period, to: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {presets(referenceDate).map((p) => (
              <button
                key={p.key}
                className={'pill' + (preset === p.key ? ' on' : '')}
                onClick={() => setPeriod({ from: p.from, to: p.to }, p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="stats">
            {usingSampleData && <span className="sample-badge">Sample data</span>}{' '}
            {list ? `${list.events.length} events · ${list.clippingCount} clippings` : ''}
          </div>
        </div>
      </div>

      {view === 'explore' && (
        <Explore
          events={events}
          selected={selected}
          setSelected={setSelected}
          onOpen={openEvent}
          onQuiz={() => setView('setup')}
        />
      )}
      {view === 'event' && eventId && (
        <EventView
          eventId={eventId}
          period={period}
          answers={asks[eventId] ?? []}
          onAnswer={(a) => setAsks((s) => ({ ...s, [eventId]: [a, ...(s[eventId] ?? [])] }))}
          onBack={() => setView('explore')}
          onTrace={() => setView('trace')}
          onQuiz={startQuiz}
        />
      )}
      {view === 'trace' && eventId && (
        <TraceView
          eventId={eventId}
          period={period}
          onPick={setEventId}
          onBack={() => setView('event')}
          onOpenEvent={openEvent}
          onWiden={(p) => setPeriod(p)}
          onQuiz={startQuiz}
        />
      )}
      {view === 'setup' && (
        <QuizSetup
          period={period}
          events={events}
          selected={selected}
          setSelected={setSelected}
          settings={settings}
          setSettings={setSettings}
          onStart={startQuiz}
        />
      )}
      {view === 'quiz' && run && (
        <QuizRun
          state={run}
          setState={setRun}
          onExit={() => setView('setup')}
          onFinish={() => setView('results')}
          onOpenEvent={openEvent}
        />
      )}
      {view === 'results' && run && (
        <Results
          period={period}
          state={run}
          onRetry={(quiz) => startQuiz(quiz)}
          onNew={() => setView('setup')}
          onOpenEvent={openEvent}
        />
      )}
    </div>
  );
}
