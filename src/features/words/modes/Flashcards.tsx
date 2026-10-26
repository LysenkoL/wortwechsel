import { useRef, useState } from 'react';
import { recordAnswer, updateCard } from '../../../db/repo';
import type { WordCard } from '../../../db/types';
import { ruWords } from '../../../i18n/ru';
import { shuffle } from '../../../words/random';
import { CardEmoji } from '../CardEmoji';
import { StudyHeader } from '../StudyHeader';
import { useSpeak } from '../useSpeak';
import type { ModeProps } from './types';

const SWIPE_PX = 80;

export function Flashcards({ cards, direction, onExit }: ModeProps) {
  const speak = useSpeak();
  const [deck, setDeck] = useState<WordCard[]>(() => shuffle(cards));
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [unknown, setUnknown] = useState<WordCard[]>([]);
  const [known, setKnown] = useState(0);
  const [starred, setStarred] = useState<Record<string, boolean>>(() => Object.fromEntries(cards.map((c) => [c.id, c.starred])));
  const startX = useRef<number | null>(null);
  const dragged = useRef(false); // a swipe also ends with a click — don't flip then
  const [dx, setDx] = useState(0);

  const card = deck[idx];
  const done = idx >= deck.length;

  function rate(knowIt: boolean) {
    if (!card) return;
    void recordAnswer(card.id, 'flashcards', knowIt);
    if (knowIt) setKnown((k) => k + 1); else setUnknown((u) => [...u, card]);
    setFlipped(false);
    setDx(0);
    setIdx((i) => i + 1);
  }

  function restart(list: WordCard[]) {
    setDeck(shuffle(list));
    setIdx(0);
    setKnown(0);
    setUnknown([]);
    setFlipped(false);
  }

  function toggleStar(c: WordCard) {
    const next = !starred[c.id];
    setStarred((s) => ({ ...s, [c.id]: next }));
    void updateCard(c.id, { starred: next });
  }

  if (done) {
    return (
      <section className="page">
        <StudyHeader title={ruWords.mode.flashcards} onExit={onExit} />
        <div className="card center">
          <div className="big-emoji" aria-hidden="true">{unknown.length === 0 ? '🎉' : '💪'}</div>
          <p role="status">{ruWords.fcDone(known, unknown.length)}</p>
        </div>
        {unknown.length > 0 && (
          <button type="button" className="btn primary block" onClick={() => restart(unknown)}>{ruWords.repeatUnknown(unknown.length)}</button>
        )}
        <button type="button" className="btn block mt" onClick={() => restart(cards)}>{ruWords.restart}</button>
        <button type="button" className="btn block mt" onClick={onExit}>{ruWords.backToDeck}</button>
      </section>
    );
  }

  const frontDe = direction === 'de-ru';
  const front = frontDe ? card.term : card.definition;
  const back = frontDe ? card.definition : card.term;
  const deSide = frontDe ? !flipped : flipped;

  return (
    <section className="page">
      <StudyHeader title={ruWords.mode.flashcards} index={idx} total={deck.length} onExit={onExit} />
      <div
        className={`flashcard${flipped ? ' flipped' : ''}`}
        style={dx ? { transform: `translateX(${dx}px) rotate(${dx / 20}deg)` } : undefined}
        role="button"
        tabIndex={0}
        aria-label={ruWords.tapToFlip}
        onClick={() => { if (!dragged.current) setFlipped((f) => !f); dragged.current = false; }}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped((f) => !f); } }}
        onPointerDown={(e) => { startX.current = e.clientX; dragged.current = false; }}
        onPointerMove={(e) => {
          if (startX.current === null) return;
          const d = e.clientX - startX.current;
          if (Math.abs(d) > 8) dragged.current = true;
          setDx(d);
        }}
        onPointerUp={() => {
          const d = dx;
          startX.current = null;
          setDx(0);
          if (d > SWIPE_PX) rate(true);
          else if (d < -SWIPE_PX) rate(false);
        }}
        onPointerCancel={() => { startX.current = null; setDx(0); }}
      >
        <CardEmoji card={card} size="lg" />
        <div className="fc-text" lang={deSide ? 'de' : 'ru'}>{flipped ? back : front}</div>
        {flipped && card.example && <div className="fc-example" lang="de">{card.example}</div>}
        {flipped && card.note && <div className="fc-note muted small">{card.note}</div>}
        {!flipped && <div className="fc-hint muted small">{ruWords.tapToFlip}</div>}
      </div>
      <div className="row center-row">
        <button type="button" className="btn icon-btn" aria-label={ruWords.listen} onClick={() => speak(card.term)}>🔊</button>
        <button
          type="button"
          className="btn icon-btn"
          aria-pressed={!!starred[card.id]}
          aria-label={starred[card.id] ? ruWords.unstar : ruWords.star}
          onClick={() => toggleStar(card)}
        >
          {starred[card.id] ? '★' : '☆'}
        </button>
      </div>
      <div className="grade-row">
        <button type="button" className="btn grade-bad" onClick={() => rate(false)}>{ruWords.stillLearning}</button>
        <button type="button" className="btn grade-good" onClick={() => rate(true)}>{ruWords.know}</button>
      </div>
      <p className="muted small center">{ruWords.swipeHint}</p>
    </section>
  );
}
