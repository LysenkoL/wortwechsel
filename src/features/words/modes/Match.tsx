import { useEffect, useRef, useState } from 'react';
import { saveMatchTime } from '../../../db/repo';
import { ruWords } from '../../../i18n/ru';
import { buildMatch, isPair, MATCH_PENALTY_MS, type Tile } from '../../../words/match';
import { StudyHeader } from '../StudyHeader';
import type { ModeProps } from './types';

const secs = (ms: number) => (ms / 1000).toFixed(1);

export function Match({ deck, cards, onExit }: ModeProps) {
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Tile | null>(null);
  const [wrongKeys, setWrongKeys] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<{ ms: number; record: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function start() {
    const t = Date.now();
    setTiles(buildMatch(cards));
    setGone(new Set());
    setSelected(null);
    setWrongKeys([]);
    setPenalty(0);
    setResult(null);
    setStartedAt(t);
    setNow(t);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setNow(Date.now()), 100);
  }

  async function finish(at: number, extraPenalty: number) {
    if (timer.current) clearInterval(timer.current);
    const ms = at - startedAt + extraPenalty;
    const record = await saveMatchTime(deck.id, ms);
    setResult({ ms, record });
  }

  function tap(t: Tile, at: number) {
    if (!tiles || gone.has(t.key) || result) return;
    if (!selected) { setSelected(t); return; }
    if (selected.key === t.key) { setSelected(null); return; }
    if (isPair(selected, t)) {
      const next = new Set(gone).add(selected.key).add(t.key);
      setGone(next);
      setSelected(null);
      if (next.size === tiles.length) void finish(at, penalty);
    } else {
      setPenalty((p) => p + MATCH_PENALTY_MS);
      setWrongKeys([selected.key, t.key]);
      setSelected(null);
      setTimeout(() => setWrongKeys([]), 400);
    }
  }

  if (!tiles) {
    return (
      <section className="page">
        <StudyHeader title={ruWords.mode.match} onExit={onExit} />
        <div className="card center">
          <div className="big-emoji" aria-hidden="true">🧩</div>
          <p>{ruWords.matchIntro}</p>
          {deck.bestMatchMs !== null && <p className="muted small">{ruWords.bestMatch(secs(deck.bestMatchMs))}</p>}
        </div>
        <button type="button" className="btn primary block" onClick={start}>{ruWords.start}</button>
      </section>
    );
  }

  if (result) {
    return (
      <section className="page">
        <StudyHeader title={ruWords.mode.match} onExit={onExit} />
        <div className="card center">
          <div className="big-emoji" aria-hidden="true">{result.record ? '🏆' : '⏱️'}</div>
          <p className="score good" role="status">{ruWords.matchDone(secs(result.ms))}</p>
          {result.record && <p>{ruWords.newRecord}</p>}
        </div>
        <button type="button" className="btn primary block" onClick={start}>{ruWords.again}</button>
        <button type="button" className="btn block mt" onClick={onExit}>{ruWords.backToDeck}</button>
      </section>
    );
  }

  return (
    <section className="page">
      <StudyHeader title={ruWords.mode.match} onExit={onExit} />
      <p className="match-timer" aria-live="off">{ruWords.matchTime(secs(now - startedAt + penalty))}</p>
      <div className="match-grid">
        {tiles.map((t) => {
          const cls = gone.has(t.key) ? ' gone' : wrongKeys.includes(t.key) ? ' wrong' : selected?.key === t.key ? ' sel' : '';
          return (
            <button
              key={t.key}
              type="button"
              className={`tile${cls}`}
              lang={t.side === 'term' ? 'de' : 'ru'}
              disabled={gone.has(t.key)}
              aria-pressed={selected?.key === t.key}
              onClick={() => tap(t, Date.now())}
            >
              {t.text}
            </button>
          );
        })}
      </div>
    </section>
  );
}
