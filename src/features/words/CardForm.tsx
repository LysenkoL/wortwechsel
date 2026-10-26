import { useState } from 'react';
import type { CardInput } from '../../db/repo';
import { ru, ruWords } from '../../i18n/ru';

interface Props {
  initial?: CardInput;
  submitLabel: string;
  onSubmit: (input: CardInput) => void | Promise<void>;
  onCancel?: () => void;
  /** Keep the form open and empty after submit (adding several cards in a row). */
  resetOnSubmit?: boolean;
}

export function CardForm({ initial, submitLabel, onSubmit, onCancel, resetOnSubmit = false }: Props) {
  const empty = { term: '', definition: '', example: '', note: '' };
  const [v, setV] = useState({ ...empty, ...initial });
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.term.trim()) return;
    await onSubmit(v);
    if (resetOnSubmit) setV(empty);
  }

  return (
    <form className="card card-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="c-term">{ruWords.term}</label>
        <input id="c-term" type="text" lang="de" value={v.term} placeholder={ruWords.termPh} onChange={set('term')} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="c-def">{ruWords.definition}</label>
        <input id="c-def" type="text" lang="ru" value={v.definition} placeholder={ruWords.definitionPh} onChange={set('definition')} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="c-ex">{ruWords.example}</label>
        <input id="c-ex" type="text" lang="de" value={v.example} onChange={set('example')} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="c-note">{ruWords.note}</label>
        <input id="c-note" type="text" value={v.note} onChange={set('note')} autoComplete="off" />
      </div>
      <div className="row">
        <button type="submit" className="btn primary" disabled={!v.term.trim()}>{submitLabel}</button>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>{ru.common.cancel}</button>}
      </div>
    </form>
  );
}
