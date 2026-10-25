import { useState } from 'react';
import type { AnalyzeResponse, Suggestion } from '../../ai/contracts.generated';
import { ruRegister, ruSpeak } from '../../i18n/ru';

interface Props {
  analysis: AnalyzeResponse;
  saving?: boolean;
  onSave: (selected: Suggestion[]) => void;
  onSpeak: (text: string) => void;
}

export function AnalysisView({ analysis, saving, onSave, onSpeak }: Props) {
  const [selected, setSelected] = useState<boolean[]>(() => analysis.suggestions.map(() => true));

  if (!analysis.is_german) return <p className="error" role="alert">{ruSpeak.notGerman}</p>;

  const count = selected.filter(Boolean).length;
  const chosen = analysis.suggestions.filter((_, i) => selected[i]);
  const toggle = (i: number) => setSelected((s) => s.map((v, j) => (j === i ? !v : v)));

  return (
    <div className="analysis">
      {analysis.corrected_sentence && (
        <section className="card" aria-label={ruSpeak.grammar}>
          <h2>{ruSpeak.grammar}</h2>
          <p>{analysis.corrected_sentence}</p>
          {analysis.grammar_notes.map((g, i) => (
            <p key={i} className="small">
              <del>{g.original}</del> → <strong>{g.correction}</strong>
              <br />
              <span className="muted">{g.explanation_ru}</span>
            </p>
          ))}
        </section>
      )}

      {analysis.suggestions.length === 0 && <p className="card">{ruSpeak.nothingToReplace}</p>}

      {analysis.suggestions.map((s, i) => (
        <article className="card" key={`${s.lemma}-${i}`}>
          <h2>
            {s.original} → <mark>{s.replacement}</mark>
          </h2>
          <p className="small">
            <strong>{s.lemma}</strong> · {s.pattern} <span className="tag">{ruRegister[s.register]}</span>
          </p>
          <p>
            {s.meaning_ru} — <span className="muted">{s.note_ru}</span>
          </p>
          <p className="small"><em>{s.example_de}</em></p>
          <label className="row">
            <input type="checkbox" checked={selected[i]} onChange={() => toggle(i)} />
            {ruSpeak.learn}
          </label>
        </article>
      ))}

      {analysis.keep.length > 0 && (
        <p className="muted small">
          {ruSpeak.canKeep}: {analysis.keep.map((k) => `${k.word} — ${k.reason_ru}`).join('; ')}
        </p>
      )}

      <section className="card" aria-label={ruSpeak.better}>
        <h2>{ruSpeak.better}</h2>
        <p>{analysis.improved_sentence}</p>
        <button type="button" className="btn" onClick={() => onSpeak(analysis.improved_sentence)}>
          🔊 {ruSpeak.listen}
        </button>
      </section>

      <button type="button" className="btn primary block" disabled={saving} onClick={() => onSave(chosen)}>
        {ruSpeak.save} ({count})
      </button>
    </div>
  );
}
