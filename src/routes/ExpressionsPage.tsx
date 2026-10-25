import { EmptyState } from '../components/EmptyState';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { deleteItem, getUtterance, listItems, setItemStage } from '../db/repo';
import type { Item, Stage } from '../db/types';
import { highlight } from '../features/review/highlight';
import { ru, ruExpr, ruRegister, ruUi } from '../i18n/ru';

const STAGES: Stage[] = ['learning', 'active', 'suspended'];
const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });

function relativeDue(due: number, now = Date.now()): string {
  const days = Math.round((due - now) / 86_400_000);
  return days <= 0 ? ruExpr.today : rtf.format(days, 'day');
}

function ItemCard({ item }: { item: Item }) {
  const utterance = useLiveQuery(() => getUtterance(item.utteranceId), [item.utteranceId]);
  const [confirming, setConfirming] = useState(false);
  const segments = utterance ? highlight(utterance.transcript, [item.original]).segments : [];

  return (
    <article className="card">
      <h2>{item.lemma}</h2>
      <p className="small">
        {item.pattern} <span className="tag">{ruRegister[item.register]}</span>
      </p>
      <p>{item.meaningRu}</p>
      {utterance && (
        <p className="small" lang="de">
          <span className="muted">{ruExpr.fromPhrase}: </span>
          {segments.map((s, i) => (s.mark ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
        </p>
      )}
      <p className="muted small">
        {ruExpr.progress(item.correctDays.length)}
        {item.stage !== 'suspended' && <> · {ruExpr.nextReview(relativeDue(item.due))}</>}
      </p>
      <div className="row">
        {item.stage === 'suspended' ? (
          <button type="button" className="btn" onClick={() => setItemStage(item.id, 'learning')}>{ruExpr.resume}</button>
        ) : (
          <button type="button" className="btn" onClick={() => setItemStage(item.id, 'suspended')}>{ruExpr.pause}</button>
        )}
        {confirming ? (
          <>
            <button type="button" className="btn danger" onClick={() => deleteItem(item.id)}>{ruExpr.yes}</button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>{ru.common.cancel}</button>
          </>
        ) : (
          <button type="button" className="btn danger" onClick={() => setConfirming(true)}>{ruExpr.delete}</button>
        )}
      </div>
    </article>
  );
}

export function ExpressionsPage() {
  const items = useLiveQuery(() => listItems(), []) ?? [];
  const [stage, setStage] = useState<Stage>('learning');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shown = items
    .filter((i) => i.stage === stage)
    .filter((i) => !q || [i.lemma, i.replacement, i.meaningRu].some((f) => f.toLowerCase().includes(q)));

  return (
    <section className="page">
      <h1>{ruExpr.title}</h1>
      <div className="chips" role="tablist">
        {STAGES.map((s) => (
          <button key={s} type="button" role="tab" className="chip" aria-selected={stage === s} aria-pressed={stage === s} onClick={() => setStage(s)}>
            {ruExpr.tabs[s]} ({items.filter((i) => i.stage === s).length})
          </button>
        ))}
      </div>
      <div className="field">
        <input type="search" aria-label={ruExpr.search} placeholder={ruExpr.search} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {items.length === 0 && (
        <EmptyState emoji="📚" title={ruUi.emptyExprTitle} text={ruUi.emptyExprText} to="/speak" cta={ruUi.goSpeak} />
      )}
      {items.length > 0 && shown.length === 0 && <p className="muted">{ruExpr.empty}</p>}
      {shown.map((item) => <ItemCard key={item.id} item={item} />)}
    </section>
  );
}
