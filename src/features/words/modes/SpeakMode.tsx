import { useEffect, useMemo, useState } from 'react';
import { RecordButton } from '../../../components/RecordButton';
import { recordAnswer } from '../../../db/repo';
import type { WordCard } from '../../../db/types';
import { ruSpeech, ruWords } from '../../../i18n/ru';
import { gradeAnswer, type Grade } from '../../../words/grade';
import { askable } from '../../../words/questions';
import { shuffle } from '../../../words/random';
import { useSpeechRecognition } from '../../speech/useSpeechRecognition';
import { StudyHeader } from '../StudyHeader';
import { AUTO_NEXT_MS } from '../WriteQuestion';
import { useSpeak } from '../useSpeak';
import type { ModeProps } from './types';

/** Russian prompt → say it in German → local check (lenient: extra words around are fine). */
export function SpeakMode({ cards, onExit }: ModeProps) {
  const speak = useSpeak();
  const speech = useSpeechRecognition({ maxSeconds: 15 });
  const pool = useMemo(() => askable(cards), [cards]);
  const [queue, setQueue] = useState<WordCard[]>(() => shuffle(pool));
  const [idx, setIdx] = useState(0);
  const [edited, setEdited] = useState<string | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [okCount, setOkCount] = useState(0);

  const card = queue[idx];
  const listening = speech.state === 'listening';
  const shown = edited ?? (listening ? `${speech.finalText} ${speech.interimText}`.trim() : speech.finalText);

  function check(given: string) {
    if (!card) return;
    if (listening) speech.stop();
    const g = gradeAnswer(card.term, given, 'de', true);
    setGrade(g);
    speak(card.term);
  }

  // Right answer: give the spoken word time to finish, then go on by itself.
  useEffect(() => {
    if (!grade?.ok) return;
    const t = setTimeout(() => next(true), AUTO_NEXT_MS[grade.verdict === 'typo' ? 'typo' : 'correct'] + 900);
    return () => clearTimeout(t);
  }, [grade]); // eslint-disable-line react-hooks/exhaustive-deps

  function next(ok: boolean) {
    if (!card || !grade) return;
    void recordAnswer(card.id, 'speak', ok);
    if (ok) setOkCount((n) => n + 1);
    setGrade(null);
    setEdited(null);
    speech.reset();
    setIdx((i) => i + 1);
  }

  if (!card) {
    return (
      <section className="page">
        <StudyHeader title={ruWords.mode.speak} onExit={onExit} />
        <div className="card center">
          <div className="big-emoji" aria-hidden="true">🎙️</div>
          <p role="status">{ruWords.scoreLine(okCount, queue.length)}</p>
        </div>
        <button type="button" className="btn primary block" onClick={() => { setQueue(shuffle(pool)); setIdx(0); setOkCount(0); }}>{ruWords.restart}</button>
        <button type="button" className="btn block mt" onClick={onExit}>{ruWords.backToDeck}</button>
      </section>
    );
  }

  return (
    <section className="page">
      <StudyHeader title={ruWords.mode.speak} index={idx} total={queue.length} onExit={onExit} />
      <p className="muted small">{ruWords.sayIt}</p>
      <div className="prompt-card" lang="ru">{card.definition}</div>

      {grade ? (
        <div className={`feedback ${grade.ok ? 'ok' : 'bad'}`} role="status">
          <p className="feedback-title">{grade.ok ? '✓' : '✗'} {ruWords.verdict[grade.verdict]}</p>
          {shown.trim() && <p className="small"><span className="muted">{ruWords.yourAnswer}: </span><span lang="de">{shown}</span></p>}
          <p><span className="muted small">{ruWords.rightAnswer}: </span><strong lang="de">{card.term}</strong></p>
          {card.example && <p className="small" lang="de"><em>{card.example}</em></p>}
          <div className="row">
            <button type="button" className="btn primary" onClick={() => next(grade.ok)}>{ruWords.next}</button>
            {!grade.ok && shown.trim() && <button type="button" className="btn" onClick={() => next(true)}>{ruWords.override}</button>}
          </div>
        </div>
      ) : (
        <>
          <RecordButton
            supported={speech.supported}
            state={speech.state}
            seconds={speech.seconds}
            maxSeconds={15}
            error={speech.error}
            onStart={() => { setEdited(null); speech.start(); }}
            onStop={speech.stop}
          />
          {!speech.supported && <p className="muted small">{ruSpeech.unsupported}</p>}
          <div className="field">
            <label htmlFor="spoken">{ruWords.recognized}</label>
            <input
              id="spoken"
              type="text"
              lang="de"
              autoComplete="off"
              value={shown}
              disabled={listening}
              onChange={(e) => setEdited(e.target.value)}
            />
          </div>
          <div className="row">
            <button type="button" className="btn primary" disabled={!shown.trim()} onClick={() => check(shown)}>{ruWords.check}</button>
            <button type="button" className="btn" onClick={() => check('')}>{ruWords.dontKnow}</button>
          </div>
        </>
      )}
    </section>
  );
}
