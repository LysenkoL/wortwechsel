import { useEffect, useMemo, useState } from 'react';
import { recordAnswer } from '../../../db/repo';
import type { WordCard } from '../../../db/types';
import { ruWords } from '../../../i18n/ru';
import { answerLang, answerOf, askable, promptOf } from '../../../words/questions';
import { shuffle } from '../../../words/random';
import { CardEmoji } from '../CardEmoji';
import { StudyHeader } from '../StudyHeader';
import { useSpeak } from '../useSpeak';
import { WriteQuestion } from '../WriteQuestion';
import type { ModeProps } from './types';

interface Props extends ModeProps {
  /** "Аудирование": the German word is only heard, and written in German. */
  listen?: boolean;
}

export function Write({ cards, direction, onExit, listen = false }: Props) {
  const speak = useSpeak();
  const pool = useMemo(() => askable(cards), [cards]);
  const [queue, setQueue] = useState<WordCard[]>(() => shuffle(pool));
  const [idx, setIdx] = useState(0);
  const [wrong, setWrong] = useState<WordCard[]>([]);
  const [hint, setHint] = useState(false);
  const [round, setRound] = useState(1);

  const card = queue[idx];
  const dir = listen ? 'ru-de' : direction; // listening always answers in German
  const lang = answerLang(dir);
  const title = listen ? ruWords.mode.listen : ruWords.mode.write;

  useEffect(() => {
    if (listen && card) speak(card.term);
  }, [listen, card, speak]);

  function done(ok: boolean) {
    if (!card) return;
    void recordAnswer(card.id, listen ? 'listen' : 'write', ok);
    if (!ok) setWrong((w) => [...w, card]);
    setHint(false);
    setIdx((i) => i + 1);
  }

  function restart(list: WordCard[]) {
    setQueue(shuffle(list));
    setIdx(0);
    setWrong([]);
    setRound((r) => r + 1);
  }

  if (!card) {
    const ok = queue.length - wrong.length;
    return (
      <section className="page">
        <StudyHeader title={title} onExit={onExit} />
        <div className="card center">
          <div className="big-emoji" aria-hidden="true">{wrong.length === 0 ? '🎉' : '✍️'}</div>
          <p role="status">{ruWords.scoreLine(ok, queue.length)}</p>
        </div>
        {wrong.length > 0 && (
          <button type="button" className="btn primary block" onClick={() => restart(wrong)}>{ruWords.repeatUnknown(wrong.length)}</button>
        )}
        <button type="button" className="btn block mt" onClick={() => restart(pool)}>{ruWords.restart}</button>
        <button type="button" className="btn block mt" onClick={onExit}>{ruWords.backToDeck}</button>
      </section>
    );
  }

  return (
    <section className="page">
      <StudyHeader title={title} index={idx} total={queue.length} onExit={onExit} />
      {listen ? (
        <div className="prompt-card center">
          <button type="button" className="btn play-btn" onClick={() => speak(card.term)}>{ruWords.play}</button>
          {hint ? <p className="muted"><CardEmoji card={card} size="sm" /> {card.definition}</p> : (
            <button type="button" className="btn small-btn mt" onClick={() => setHint(true)}>{ruWords.showHint}</button>
          )}
        </div>
      ) : (
        <div className="prompt-card" lang={dir === 'ru-de' ? 'ru' : 'de'}><CardEmoji card={card} />{promptOf(card, dir)}</div>
      )}
      <WriteQuestion
        key={`${round}-${idx}`}
        expected={answerOf(card, dir)}
        lang={lang}
        onDone={done}
        onChecked={() => { if (!listen && lang === 'de') speak(card.term); }}
      />
    </section>
  );
}
