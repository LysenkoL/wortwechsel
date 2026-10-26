import { useMemo, useState } from 'react';
import { recordAnswer } from '../../../db/repo';
import { ruWords } from '../../../i18n/ru';
import {
  answer as answerLearn, continueLearn, current, isFinished, learnedCount, startLearn,
} from '../../../words/learn';
import { answerLang, answerOf, askable, choices, promptOf } from '../../../words/questions';
import { ChoiceQuestion } from '../ChoiceQuestion';
import { StudyHeader } from '../StudyHeader';
import { useSpeak } from '../useSpeak';
import { WriteQuestion } from '../WriteQuestion';
import type { ModeProps } from './types';

export function Learn({ cards, direction, onExit }: ModeProps) {
  const speak = useSpeak();
  const pool = useMemo(() => askable(cards), [cards]);
  const byId = useMemo(() => new Map(pool.map((c) => [c.id, c])), [pool]);
  const [state, setState] = useState(() => startLearn(pool.map((c) => c.id)));
  const [turn, setTurn] = useState(0); // remounts question components

  const q = current(state);
  const total = pool.length;
  const learned = learnedCount(state);
  const lang = answerLang(direction);
  const qId = q?.id;
  const qStep = q?.step;
  // Options are fixed per question (re-renders must not reshuffle them).
  const options = useMemo(() => {
    const c = qId ? byId.get(qId) : undefined;
    return c && qStep === 'mc' ? choices(c, pool, direction) : [];
  }, [qId, qStep, turn, byId, pool, direction]); // eslint-disable-line react-hooks/exhaustive-deps

  function done(ok: boolean) {
    if (!q) return;
    void recordAnswer(q.id, 'learn', ok);
    setState((s) => answerLearn(s, ok));
    setTurn((t) => t + 1);
  }

  const bar = (
    <div className="study-progress learn-bar" aria-label={ruWords.learned(learned, total)}>
      <span style={{ width: `${total ? (learned / total) * 100 : 0}%` }} />
    </div>
  );

  if (isFinished(state)) {
    return (
      <section className="page">
        <StudyHeader title={ruWords.mode.learn} onExit={onExit} />
        <div className="card center">
          <div className="big-emoji" aria-hidden="true">🎉</div>
          <p role="status">{ruWords.learnDone}</p>
        </div>
        <button type="button" className="btn primary block" onClick={() => { setState(startLearn(pool.map((c) => c.id))); setTurn((t) => t + 1); }}>
          {ruWords.restart}
        </button>
        <button type="button" className="btn block mt" onClick={onExit}>{ruWords.backToDeck}</button>
      </section>
    );
  }

  if (!q) {
    return (
      <section className="page">
        <StudyHeader title={ruWords.mode.learn} onExit={onExit} />
        {bar}
        <div className="card center">
          <h2>{ruWords.roundDone}</h2>
          <p role="status">{ruWords.learned(learned, total)}</p>
        </div>
        <button type="button" className="btn primary block" onClick={() => setState((s) => continueLearn(s))}>{ruWords.continue}</button>
      </section>
    );
  }

  const card = byId.get(q.id)!;
  const prompt = promptOf(card, direction);
  const expected = answerOf(card, direction);

  return (
    <section className="page">
      <StudyHeader title={`${ruWords.mode.learn} · ${ruWords.round(state.round)}`} onExit={onExit} />
      {bar}
      <p className="muted small">{q.step === 'mc' ? ruWords.chooseRight : ruWords.writeIt}</p>
      <div className="prompt-card" lang={direction === 'ru-de' ? 'ru' : 'de'}>
        {prompt}
        {direction === 'de-ru' && (
          <button type="button" className="btn icon-btn inline-icon" aria-label={ruWords.listen} onClick={() => speak(card.term)}>🔊</button>
        )}
      </div>
      {q.step === 'mc' ? (
        <ChoiceQuestion key={turn} options={options} answer={expected} lang={lang} onDone={done} />
      ) : (
        <WriteQuestion key={turn} expected={expected} lang={lang} onDone={done} onChecked={() => { if (lang === 'de') speak(card.term); }} />
      )}
    </section>
  );
}
