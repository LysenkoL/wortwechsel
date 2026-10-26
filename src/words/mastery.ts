import type { CardStats, WordCard } from '../db/types';

export type Mastery = 'new' | 'learning' | 'known';

/** Two correct answers in a row (in any mode) = "знаю"; one mistake drops it back. */
export const KNOWN_STREAK = 2;

export function masteryOf(stats: CardStats): Mastery {
  if (stats.seen === 0) return 'new';
  return stats.streak >= KNOWN_STREAK ? 'known' : 'learning';
}

export function masteryCounts(cards: Pick<WordCard, 'stats'>[]): Record<Mastery, number> {
  const out: Record<Mastery, number> = { new: 0, learning: 0, known: 0 };
  for (const c of cards) out[masteryOf(c.stats)] += 1;
  return out;
}

export function nextStats(stats: CardStats, correct: boolean, at: number): CardStats {
  return {
    seen: stats.seen + 1,
    correct: stats.correct + (correct ? 1 : 0),
    wrong: stats.wrong + (correct ? 0 : 1),
    streak: correct ? stats.streak + 1 : 0,
    lastAt: at,
  };
}

export const emptyStats = (): CardStats => ({ seen: 0, correct: 0, wrong: 0, streak: 0, lastAt: null });
