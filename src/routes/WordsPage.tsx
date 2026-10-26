import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { addStarterDeck, createDeck, listDecks, wordStats, type DeckSummary } from '../db/repo';
import type { Context } from '../db/types';
import { DeckForm } from '../features/words/DeckForm';
import { MasteryBar } from '../features/words/MasteryBar';
import { useWordsDue } from '../features/words/useWordsDue';
import { ruContext, ruWords } from '../i18n/ru';
import { STARTER_DECKS } from '../words/starters';

const CONTEXTS: Context[] = ['work', 'daily', 'office', 'free'];

function DeckTile({ s }: { s: DeckSummary }) {
  return (
    <Link to={`/words/${s.deck.id}`} className="deck-tile">
      <span className="deck-emoji" aria-hidden="true">{s.deck.emoji}</span>
      <span className="deck-info">
        <span className="deck-name">{s.deck.title}</span>
        <span className="muted small">{ruWords.deckCount(s.total)}</span>
        <MasteryBar cards={s.cards} />
      </span>
    </Link>
  );
}

export function WordsPage() {
  const navigate = useNavigate();
  const decks = useLiveQuery(() => listDecks(), []);
  const stats = useLiveQuery(() => wordStats(), []);
  const due = useWordsDue();
  const [filter, setFilter] = useState<Context | 'all'>('all');
  const [creating, setCreating] = useState(false);

  if (!decks) return <section className="page"><h1>{ruWords.title}</h1></section>;

  const takenStarters = new Set(decks.map((d) => d.deck.starterId).filter(Boolean));
  const starters = STARTER_DECKS.filter((s) => !takenStarters.has(s.id) && (filter === 'all' || s.context === filter));
  const shown = decks.filter((d) => filter === 'all' || d.deck.context === filter);
  const totalCards = decks.reduce((n, d) => n + d.total, 0);

  return (
    <section className="page">
      <h1>{ruWords.title}</h1>

      {totalCards > 0 && (
        <div className="card review-card">
          <div>
            <h2>🔁 {ruWords.reviewTitle}</h2>
            <p className="small">{ruWords.reviewDue(due)}</p>
            {stats && stats.answers > 0 && <p className="small muted">{ruWords.today(stats.answers, stats.correct)}</p>}
            {stats && stats.streakDays > 1 && <p className="small muted">{ruWords.streak(stats.streakDays)}</p>}
          </div>
          <button type="button" className="btn primary" disabled={due === 0} onClick={() => navigate('/words/review')}>{ruWords.reviewStart}</button>
        </div>
      )}

      <div className="chips" role="tablist">
        {(['all', ...CONTEXTS] as const).map((c) => (
          <button key={c} type="button" role="tab" className="chip" aria-selected={filter === c} aria-pressed={filter === c} onClick={() => setFilter(c)}>
            {c === 'all' ? ruWords.all : ruContext[c]}
          </button>
        ))}
      </div>

      {creating ? (
        <DeckForm
          submitLabel={ruWords.create}
          initial={{ title: '', emoji: '📘', context: filter === 'all' ? 'work' : filter, description: '' }}
          onCancel={() => setCreating(false)}
          onSubmit={async (input) => navigate(`/words/${await createDeck(input)}`)}
        />
      ) : (
        <button type="button" className="btn ghost block" onClick={() => setCreating(true)}>{ruWords.newDeck}</button>
      )}

      {decks.length === 0 && !creating && (
        <EmptyState emoji="🗂️" title={ruWords.emptyTitle} text={ruWords.emptyText} />
      )}

      {CONTEXTS.map((c) => {
        const group = shown.filter((d) => d.deck.context === c);
        if (group.length === 0) return null;
        return (
          <section key={c} className="deck-group">
            <h2>{ruContext[c]}</h2>
            {group.map((s) => <DeckTile key={s.deck.id} s={s} />)}
          </section>
        );
      })}

      {starters.length > 0 && (
        <section className="deck-group">
          <h2>{ruWords.starters}</h2>
          <p className="small muted">{ruWords.startersHint}</p>
          {starters.map((s) => (
            <div key={s.id} className="deck-tile starter">
              <span className="deck-emoji" aria-hidden="true">{s.emoji}</span>
              <span className="deck-info">
                <span className="deck-name">{s.title}</span>
                <span className="muted small">{ruContext[s.context]} · {ruWords.deckCount(s.cards.length)}</span>
              </span>
              <button type="button" className="btn small-btn" onClick={() => void addStarterDeck(s)} aria-label={`${ruWords.addStarter}: ${s.title}`}>
                {ruWords.addStarter}
              </button>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}
