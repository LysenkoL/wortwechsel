import { ruWords } from '../../i18n/ru';

export function StudyHeader({ title, index, total, onExit }: { title: string; index?: number; total?: number; onExit: () => void }) {
  const pct = total ? Math.min(100, ((index ?? 0) / total) * 100) : 0;
  return (
    <div className="study-head">
      <div className="row study-head-row">
        <button type="button" className="btn small-btn" onClick={onExit}>{ruWords.exit}</button>
        <strong className="study-title">{title}</strong>
        {total !== undefined && <span className="muted small">{ruWords.progress(Math.min((index ?? 0) + 1, total), total)}</span>}
      </div>
      {total !== undefined && <div className="study-progress"><span style={{ width: `${pct}%` }} /></div>}
    </div>
  );
}
