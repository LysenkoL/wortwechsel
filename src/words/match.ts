import type { StudyCard } from './questions';
import { sample, shuffle, type Rng } from './random';

export interface Tile {
  key: string; // unique tile id
  pairId: string; // card id
  text: string;
  side: 'term' | 'definition';
}

export const MATCH_PAIRS = 6;
export const MATCH_PENALTY_MS = 1000;

export function buildMatch(cards: StudyCard[], rng: Rng = Math.random, pairs = MATCH_PAIRS): Tile[] {
  const picked = sample(cards.filter((c) => c.term.trim() && c.definition.trim()), pairs, rng);
  const tiles = picked.flatMap((c) => [
    { key: `${c.id}-t`, pairId: c.id, text: c.term, side: 'term' as const },
    { key: `${c.id}-d`, pairId: c.id, text: c.definition, side: 'definition' as const },
  ]);
  return shuffle(tiles, rng);
}

export const isPair = (a: Tile, b: Tile) => a.pairId === b.pairId && a.side !== b.side;
