import { useState } from 'react';
import { generateCards } from '../../ai/client';
import { ErrorNotice } from '../../components/ErrorNotice';
import { addCards, updateCard } from '../../db/repo';
import type { Deck, WordCard } from '../../db/types';
import { ruWords } from '../../i18n/ru';
import { describeAiError, type DescribedError } from '../aiErrorText';

const COUNTS = [5, 10, 15, 20];

const topicOf = (deck: Deck) => [deck.title, deck.description].filter(Boolean).join('. ').slice(0, 600);

/** "Слова на тему": new cards for the deck's topic. */
export function AiTopicPanel({ deck, cards, onDone }: { deck: Deck; cards: WordCard[]; onDone: (msg: string) => void }) {
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DescribedError | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await generateCards({
        mode: 'topic', topic: topicOf(deck), context: deck.context, count, words: [], exclude: cards.map((c) => c.term),
      });
      const n = await addCards(deck.id, res.cards.map((c) => ({
        term: c.term, definition: c.definition_ru, example: c.example_de, note: c.note_ru,
      })));
      onDone(ruWords.added(n));
    } catch (e) {
      setError(describeAiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <p className="small muted">{ruWords.aiHint}</p>
      <p className="small">{ruWords.aiCount}</p>
      <div className="chips">
        {COUNTS.map((n) => (
          <button key={n} type="button" className="chip" aria-pressed={count === n} onClick={() => setCount(n)}>{n}</button>
        ))}
      </div>
      {error && <ErrorNotice error={error} onRetry={run} />}
      <button type="button" className="btn primary" disabled={busy} onClick={run}>{busy ? ruWords.aiGenerating : ruWords.aiGenerate}</button>
    </div>
  );
}

/** Cards that still need a translation or an example. */
export const incomplete = (cards: WordCard[]) => cards.filter((c) => !c.definition || !c.example);

/** "Дополнить": translation/example for her own words, without overwriting what she typed. */
export async function completeCards(deck: Deck, cards: WordCard[]): Promise<number> {
  const todo = incomplete(cards).slice(0, 30);
  if (todo.length === 0) return 0;
  const res = await generateCards({
    mode: 'complete', topic: topicOf(deck), context: deck.context, count: todo.length,
    words: todo.map((c) => (c.definition ? `${c.term} — ${c.definition}` : c.term).slice(0, 600)), exclude: [],
  });
  let n = 0;
  for (let i = 0; i < todo.length && i < res.cards.length; i++) {
    const c = todo[i];
    const g = res.cards[i];
    await updateCard(c.id, {
      definition: c.definition || g.definition_ru,
      example: c.example || g.example_de,
      note: c.note || g.note_ru,
    });
    n++;
  }
  return n;
}
