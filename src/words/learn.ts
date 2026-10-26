// "Заучивание" (Quizlet Learn): rounds of up to 7 cards; each card is first asked as a
// multiple choice, then must be written. A wrong answer sends the card to the end of the round.
import type { Rng } from './random';
import { shuffle } from './random';

export const ROUND_SIZE = 7;

export interface LearnState {
  progress: Record<string, number>; // 0 = needs choice, 1 = needs writing, 2 = learned
  queue: string[]; // current round, head is being asked
  round: number;
  roundIds: string[];
  roundDone: boolean;
  skipChoice: boolean; // too few cards for a choice question
}

export type LearnStep = 'mc' | 'write';

export function startLearn(ids: string[], rng: Rng = Math.random, skipChoice = ids.length < 2): LearnState {
  const progress = Object.fromEntries(ids.map((id) => [id, skipChoice ? 1 : 0]));
  return nextRound({ progress, queue: [], round: 0, roundIds: shuffle(ids, rng), roundDone: false, skipChoice });
}

function nextRound(s: LearnState): LearnState {
  // roundIds keeps a stable (shuffled) order of all ids; take the first unfinished ones.
  const open = s.roundIds.filter((id) => s.progress[id] < 2);
  const queue = open.slice(0, ROUND_SIZE);
  const rest = s.roundIds.filter((id) => !queue.includes(id));
  return { ...s, queue, round: s.round + 1, roundIds: [...rest, ...queue], roundDone: false };
}

export function current(s: LearnState): { id: string; step: LearnStep } | null {
  if (s.roundDone || s.queue.length === 0) return null;
  const id = s.queue[0];
  return { id, step: s.progress[id] === 0 ? 'mc' : 'write' };
}

export function answer(s: LearnState, ok: boolean): LearnState {
  const id = s.queue[0];
  if (id === undefined) return s;
  const progress = { ...s.progress };
  if (ok) progress[id] = Math.min(2, progress[id] + 1);
  const rest = s.queue.slice(1);
  // Not finished in this round (wrong, or passed only the choice) → ask again later in the round.
  const queue = progress[id] < 2 && !ok ? [...rest, id] : rest;
  // A card that just passed the choice step comes back for writing in the next round.
  const roundDone = queue.length === 0;
  return { ...s, progress, queue, roundDone };
}

export function continueLearn(s: LearnState): LearnState {
  return nextRound(s);
}

export function learnedCount(s: LearnState): number {
  return Object.values(s.progress).filter((p) => p >= 2).length;
}

export function isFinished(s: LearnState): boolean {
  return Object.values(s.progress).every((p) => p >= 2);
}
