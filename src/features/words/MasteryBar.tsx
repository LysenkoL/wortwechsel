import type { WordCard } from '../../db/types';
import { ruWords } from '../../i18n/ru';
import { masteryCounts } from '../../words/mastery';

export function MasteryBar({ cards, legend = false }: { cards: Pick<WordCard, 'stats'>[]; legend?: boolean }) {
  const c = masteryCounts(cards);
  const total = cards.length || 1;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="mastery">
      <div className="mastery-bar" role="img" aria-label={`${ruWords.mastery.known}: ${c.known}, ${ruWords.mastery.learning}: ${c.learning}, ${ruWords.mastery.new}: ${c.new}`}>
        <span className="m-known" style={{ width: pct(c.known) }} />
        <span className="m-learning" style={{ width: pct(c.learning) }} />
      </div>
      {legend && (
        <div className="mastery-legend small">
          <span><i className="dot m-known" />{ruWords.mastery.known} {c.known}</span>
          <span><i className="dot m-learning" />{ruWords.mastery.learning} {c.learning}</span>
          <span><i className="dot m-new" />{ruWords.mastery.new} {c.new}</span>
        </div>
      )}
    </div>
  );
}
