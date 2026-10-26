import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { addCardsFromItems, listItems } from '../../db/repo';
import type { WordCard } from '../../db/types';
import { ruWords } from '../../i18n/ru';

/** Pick saved expressions (from "Говорить") and copy them into the deck as cards. */
export function FromExpressions({ deckId, cards, onDone }: { deckId: string; cards: WordCard[]; onDone: (msg: string) => void }) {
  const items = useLiveQuery(() => listItems(), []) ?? [];
  const taken = new Set(cards.map((c) => c.sourceItemId).filter(Boolean));
  const terms = new Set(cards.map((c) => c.term.toLowerCase()));
  const free = items.filter((i) => !taken.has(i.id) && !terms.has(i.lemma.toLowerCase()));
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (itemId: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(itemId)) n.delete(itemId); else n.add(itemId);
    return n;
  });

  async function add() {
    const n = await addCardsFromItems(deckId, free.filter((i) => picked.has(i.id)));
    setPicked(new Set());
    onDone(ruWords.added(n));
  }

  if (free.length === 0) return <p className="card muted">{ruWords.fromExprEmpty}</p>;

  return (
    <div className="card">
      <button type="button" className="btn small-btn" onClick={() => setPicked(new Set(free.map((i) => i.id)))}>{ruWords.selectAll}</button>
      <ul className="pick-list">
        {free.map((i) => (
          <li key={i.id}>
            <label className="row">
              <input type="checkbox" checked={picked.has(i.id)} onChange={() => toggle(i.id)} />
              <span><strong lang="de">{i.lemma}</strong> — {i.meaningRu}</span>
            </label>
          </li>
        ))}
      </ul>
      <button type="button" className="btn primary" disabled={picked.size === 0} onClick={add}>{ruWords.addSelected(picked.size)}</button>
    </div>
  );
}
