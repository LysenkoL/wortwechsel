import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorNotice } from '../components/ErrorNotice';
import {
  addCards, DEFAULT_NEW_PER_DAY, deleteCard, deleteDeck, getDeck, getSetting, getWordReviewQueue,
  listCards, resetDeckStats, updateCard, updateDeck,
} from '../db/repo';
import type { StudyMode, WordCard } from '../db/types';
import { describeAiError, type DescribedError } from '../features/aiErrorText';
import { AiTopicPanel, completeCards, incomplete } from '../features/words/AiPanel';
import { CardForm } from '../features/words/CardForm';
import { DeckForm } from '../features/words/DeckForm';
import { FromExpressions } from '../features/words/FromExpressions';
import { ImportPanel } from '../features/words/ImportPanel';
import { MasteryBar } from '../features/words/MasteryBar';
import { useSpeak } from '../features/words/useSpeak';
import { useSetting } from '../features/useSetting';
import { ru, ruContext, ruWords } from '../i18n/ru';
import { masteryOf } from '../words/mastery';
import { askable, type Direction } from '../words/questions';

const MODES: StudyMode[] = ['flashcards', 'learn', 'write', 'listen', 'speak', 'test', 'match', 'review'];
type Panel = 'add' | 'import' | 'ai' | 'expr' | null;

function CardRow({ card }: { card: WordCard }) {
  const speak = useSpeak();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (editing) {
    return (
      <CardForm
        initial={card}
        submitLabel={ruWords.save}
        onCancel={() => setEditing(false)}
        onSubmit={async (v) => {
          await updateCard(card.id, { term: v.term, definition: v.definition, example: v.example ?? '', note: v.note ?? '' });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <article className="card word-row">
      <div className="word-main">
        <span className={`dot m-${masteryOf(card.stats)}`} aria-label={ruWords.mastery[masteryOf(card.stats)]} />
        <div>
          <p className="word-term" lang="de">{card.term}</p>
          <p className="word-def">{card.definition || <span className="muted">—</span>}</p>
          {card.example && <p className="small muted" lang="de"><em>{card.example}</em></p>}
          {card.note && <p className="small muted">{card.note}</p>}
        </div>
      </div>
      <div className="word-actions">
        <button type="button" className="btn icon-btn" aria-label={ruWords.listen} onClick={() => speak(card.term)}>🔊</button>
        <button
          type="button"
          className="btn icon-btn"
          aria-pressed={card.starred}
          aria-label={card.starred ? ruWords.unstar : ruWords.star}
          onClick={() => updateCard(card.id, { starred: !card.starred })}
        >
          {card.starred ? '★' : '☆'}
        </button>
        <button type="button" className="btn icon-btn" aria-label={ruWords.edit} onClick={() => setEditing(true)}>✎</button>
        {confirming ? (
          <>
            <button type="button" className="btn danger small-btn" onClick={() => deleteCard(card.id)}>{ruWords.confirmRemove}</button>
            <button type="button" className="btn small-btn" onClick={() => setConfirming(false)}>{ru.common.cancel}</button>
          </>
        ) : (
          <button type="button" className="btn icon-btn" aria-label={ruWords.remove} onClick={() => setConfirming(true)}>🗑</button>
        )}
      </div>
    </article>
  );
}

export function DeckPage() {
  const { deckId = '' } = useParams();
  const navigate = useNavigate();
  const deck = useLiveQuery(() => getDeck(deckId), [deckId]);
  const cards = useLiveQuery(() => listCards(deckId), [deckId]);
  const dueCount = useLiveQuery(async () => {
    const perDay = await getSetting<number>('wordsNewPerDay', DEFAULT_NEW_PER_DAY);
    return (await getWordReviewQueue(new Date(), perDay, deckId)).length;
  }, [deckId]) ?? 0;
  const [direction, setDirection] = useSetting<Direction>('wordsDirection', 'ru-de');
  const [starredOnly, setStarredOnly] = useState(false);
  const [editing, setEditing] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [aiError, setAiError] = useState<DescribedError | null>(null);
  const [danger, setDanger] = useState<'delete' | null>(null);

  if (deck === undefined || cards === undefined) {
    // useLiveQuery returns undefined both while loading and for a missing row.
    return (
      <section className="page">
        <p className="muted">{ru.common.loading}</p>
        <Link to="/words" className="btn">{ruWords.toWords}</Link>
      </section>
    );
  }

  const starredCount = cards.filter((c) => c.starred).length;
  const studyable = askable(starredOnly ? cards.filter((c) => c.starred) : cards);
  const todo = incomplete(cards);

  const done = (msg: string) => { setMessage(msg); setPanel(null); };
  const togglePanel = (p: Panel) => { setMessage(null); setAiError(null); setPanel(panel === p ? null : p); };

  async function complete() {
    if (!deck) return;
    setCompleting(true);
    setAiError(null);
    setMessage(null);
    try {
      setMessage(ruWords.added(await completeCards(deck, cards ?? [])));
    } catch (e) {
      setAiError(describeAiError(e));
    } finally {
      setCompleting(false);
    }
  }

  function open(mode: StudyMode) {
    const q = new URLSearchParams({ dir: direction });
    if (starredOnly) q.set('starred', '1');
    navigate(mode === 'review' ? `/words/review?deck=${deck!.id}&dir=${direction}` : `/words/${deck!.id}/${mode}?${q}`);
  }

  const modeDisabled = (m: StudyMode) =>
    m === 'review' ? dueCount === 0 : m === 'match' || m === 'test' || m === 'learn' ? studyable.length < 2 : studyable.length < 1;

  return (
    <section className="page">
      <Link to="/words" className="back-link">← {ruWords.toWords}</Link>

      {editing ? (
        <DeckForm
          initial={deck}
          submitLabel={ruWords.save}
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => { await updateDeck(deck.id, input); setEditing(false); }}
        />
      ) : (
        <header className="deck-head">
          <span className="deck-emoji big" aria-hidden="true">{deck.emoji}</span>
          <div className="deck-head-text">
            <h1>{deck.title}</h1>
            <p className="small"><span className="tag">{ruContext[deck.context]}</span> {ruWords.deckCount(cards.length)}</p>
            {deck.description && <p className="small muted">{deck.description}</p>}
          </div>
          <button type="button" className="btn icon-btn" aria-label={ruWords.edit} onClick={() => setEditing(true)}>✎</button>
        </header>
      )}

      {cards.length > 0 && <MasteryBar cards={cards} legend />}

      <h2 className="mt">{ruWords.modes}</h2>
      <div className="row options-row">
        <span className="small muted">{ruWords.direction}:</span>
        {(['ru-de', 'de-ru'] as const).map((d) => (
          <button key={d} type="button" className="chip" aria-pressed={direction === d} onClick={() => setDirection(d)}>{ruWords.dir[d]}</button>
        ))}
        {starredCount > 0 && (
          <button type="button" className="chip" aria-pressed={starredOnly} onClick={() => setStarredOnly(!starredOnly)}>{ruWords.starredOnly(starredCount)}</button>
        )}
      </div>
      {studyable.length < 2 && <p className="small muted">{ruWords.needCards}</p>}
      <div className="mode-grid">
        {MODES.map((m) => (
          <button key={m} type="button" className="mode-btn" disabled={modeDisabled(m)} onClick={() => open(m)}>
            <span className="mode-emoji" aria-hidden="true">{ruWords.modeEmoji[m]}</span>
            <span className="mode-name">{ruWords.mode[m]}{m === 'review' && dueCount > 0 ? ` (${dueCount})` : ''}</span>
            <span className="mode-hint">{m === 'match' && deck.bestMatchMs !== null ? ruWords.bestMatch((deck.bestMatchMs / 1000).toFixed(1)) : ruWords.modeHint[m]}</span>
          </button>
        ))}
      </div>

      <h2 className="mt">{ruWords.cards(cards.length)}</h2>
      <div className="chips">
        <button type="button" className="chip" aria-pressed={panel === 'add'} onClick={() => togglePanel('add')}>{ruWords.addCard}</button>
        <button type="button" className="chip" aria-pressed={panel === 'import'} onClick={() => togglePanel('import')}>{ruWords.importList}</button>
        <button type="button" className="chip" aria-pressed={panel === 'ai'} onClick={() => togglePanel('ai')}>{ruWords.aiTopic}</button>
        <button type="button" className="chip" aria-pressed={panel === 'expr'} onClick={() => togglePanel('expr')}>{ruWords.fromExpressions}</button>
        {todo.length > 0 && (
          <button type="button" className="chip" disabled={completing} onClick={complete}>
            {completing ? ruWords.aiCompleting : ruWords.aiComplete(todo.length)}
          </button>
        )}
      </div>
      {message && <p role="status" className="small">{message}</p>}
      {aiError && <ErrorNotice error={aiError} onRetry={complete} />}

      {panel === 'add' && (
        <CardForm
          submitLabel={ruWords.add}
          resetOnSubmit
          onCancel={() => setPanel(null)}
          onSubmit={async (v) => setMessage(ruWords.added(await addCards(deck.id, [v])))}
        />
      )}
      {panel === 'import' && <ImportPanel deckId={deck.id} onDone={done} />}
      {panel === 'ai' && <AiTopicPanel deck={deck} cards={cards} onDone={done} />}
      {panel === 'expr' && <FromExpressions deckId={deck.id} cards={cards} onDone={done} />}

      {cards.length === 0 && <p className="muted">{ruWords.noCards}</p>}
      {cards.map((c) => <CardRow key={c.id} card={c} />)}

      <div className="row mt danger-zone">
        {cards.length > 0 && (
          <button type="button" className="btn small-btn" onClick={async () => { await resetDeckStats(deck.id); setMessage(ruWords.resetDone); }}>
            {ruWords.resetProgress}
          </button>
        )}
        {danger === 'delete' ? (
          <>
            <span className="small">{ruWords.confirmDeleteDeck}</span>
            <button type="button" className="btn danger small-btn" onClick={async () => { await deleteDeck(deck.id); navigate('/words'); }}>{ruWords.confirmRemove}</button>
            <button type="button" className="btn small-btn" onClick={() => setDanger(null)}>{ru.common.cancel}</button>
          </>
        ) : (
          <button type="button" className="btn danger small-btn" onClick={() => setDanger('delete')}>{ruWords.deleteDeck}</button>
        )}
      </div>
    </section>
  );
}
