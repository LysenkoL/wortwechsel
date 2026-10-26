import { useState } from 'react';
import { recordAnswer, reviewWord } from '../../../db/repo';
import type { Rating, WordCard } from '../../../db/types';
import { ruWords } from '../../../i18n/ru';
import type { Direction } from '../../../words/questions';
import { CardEmoji } from '../CardEmoji';
import { StudyHeader } from '../StudyHeader';
import { useSpeak } from '../useSpeak';

interface Props {
  queue: WordCard[];
  direction: Direction;
  onExit: () => void;
}

const RATINGS: Rating[] = [1, 2, 3, 4];

/**
 * Spaced repetition: show → recall → self-rating. Only the first rating of a card in a session
 * goes to FSRS; "Снова" puts the card at the end of the session once more for practice.
 */
export function Review({ queue: initial, direction, onExit }: Props) {
  const speak = useSpeak();
  const [queue, setQueue] = useState<WordCard[]>(initial);
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(false);
  const [rated, setRated] = useState<Set<string>>(new Set());

  const card = queue[idx];

  function rate(r: Rating) {
    if (!card) return;
    const first = !rated.has(card.id);
    if (first) void reviewWord(card.id, r);
    else void recordAnswer(card.id, 'review', r >= 3);
    setRated((s) => new Set(s).add(card.id));
    if (r === 1) setQueue((q) => [...q, card]);
    setShown(false);
    setIdx((i) => i + 1);
  }

  if (!card) {
    return (
      <section className="page">
        <StudyHeader title={ruWords.mode.review} onExit={onExit} />
        <div className="card center">
          <div className="big-emoji" aria-hidden="true">{initial.length ? '✅' : '🌿'}</div>
          <p role="status">{initial.length ? ruWords.reviewDone(rated.size) : ruWords.reviewNothing}</p>
        </div>
        <button type="button" className="btn primary block" onClick={onExit}>{ruWords.toWords}</button>
      </section>
    );
  }

  const frontDe = direction === 'de-ru';
  return (
    <section className="page">
      <StudyHeader title={ruWords.mode.review} index={idx} total={queue.length} onExit={onExit} />
      <div className="prompt-card big" lang={frontDe ? 'de' : 'ru'}><CardEmoji card={card} size="lg" />{frontDe ? card.term : card.definition}</div>
      {!shown ? (
        <button type="button" className="btn primary block" onClick={() => { setShown(true); speak(card.term); }}>{ruWords.showAnswer}</button>
      ) : (
        <>
          <div className="card">
            <p className="answer-text" lang={frontDe ? 'ru' : 'de'}><strong>{frontDe ? card.definition : card.term}</strong>
              <button type="button" className="btn icon-btn inline-icon" aria-label={ruWords.listen} onClick={() => speak(card.term)}>🔊</button>
            </p>
            {card.example && <p className="small" lang="de"><em>{card.example}</em></p>}
            {card.note && <p className="small muted">{card.note}</p>}
          </div>
          <div className="rating-row">
            {RATINGS.map((r) => (
              <button key={r} type="button" className={`btn rate-${r}`} onClick={() => rate(r)}>{ruWords.ratings[r]}</button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
