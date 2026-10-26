import { useState } from 'react';
import { addCards } from '../../db/repo';
import { ruWords } from '../../i18n/ru';
import { parseImport } from '../../words/parseImport';

export function ImportPanel({ deckId, onDone }: { deckId: string; onDone: (msg: string) => void }) {
  const [text, setText] = useState('');
  const parsed = parseImport(text);

  async function add() {
    const n = await addCards(deckId, parsed);
    setText('');
    onDone(ruWords.added(n));
  }

  return (
    <div className="card">
      <p className="small muted">{ruWords.importHelp}</p>
      <textarea aria-label={ruWords.importList} value={text} placeholder={ruWords.importPh} onChange={(e) => setText(e.target.value)} rows={6} />
      <p className="small muted">{ruWords.importPreview(parsed.length)}</p>
      <button type="button" className="btn primary" disabled={parsed.length === 0} onClick={add}>{ruWords.add}</button>
    </div>
  );
}
