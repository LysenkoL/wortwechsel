import { useState } from 'react';
import type { DeckInput } from '../../db/repo';
import type { Context } from '../../db/types';
import { ru, ruContext, ruWords } from '../../i18n/ru';

const CONTEXTS: Context[] = ['work', 'daily', 'office', 'free'];
const EMOJIS = ['📘', '💼', '🏛️', '🏠', '🩺', '🛒', '✈️', '💻', '🍽️', '🚆', '👪', '💬', '⚽', '🎓', '💶', '🌿'];

interface Props {
  initial?: DeckInput;
  submitLabel: string;
  onSubmit: (input: DeckInput) => void | Promise<void>;
  onCancel?: () => void;
}

export function DeckForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '📘');
  const [context, setContext] = useState<Context>(initial?.context ?? 'work');
  const [description, setDescription] = useState(initial?.description ?? '');

  return (
    <form
      className="card"
      onSubmit={(e) => { e.preventDefault(); if (title.trim()) void onSubmit({ title, emoji, context, description }); }}
    >
      <div className="field">
        <label htmlFor="deck-title">{ruWords.deckTitle}</label>
        <input id="deck-title" type="text" value={title} placeholder={ruWords.deckTitlePh} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <span className="label">{ruWords.deckTopic}</span>
        <div className="chips">
          {CONTEXTS.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={context === c} onClick={() => setContext(c)}>{ruContext[c]}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="label">{ruWords.deckEmoji}</span>
        <div className="emoji-pick">
          {EMOJIS.map((em) => (
            <button key={em} type="button" className="emoji-btn" aria-pressed={emoji === em} aria-label={em} onClick={() => setEmoji(em)}>{em}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="deck-desc">{ruWords.deckDescription}</label>
        <textarea id="deck-desc" value={description} placeholder={ruWords.deckDescriptionPh} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="row">
        <button type="submit" className="btn primary" disabled={!title.trim()}>{submitLabel}</button>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>{ru.common.cancel}</button>}
      </div>
    </form>
  );
}
