import { createEmptyCard, fsrs, generatorParameters, type Card, type Grade, State } from 'ts-fsrs';
import type { Rating, SerializedCard } from '../db/types';

// Errors come back the next day, not after 10 minutes: a spoken review is heavy.
const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    maximum_interval: 180,
    enable_fuzz: true,
    enable_short_term: false,
  }),
);

export function serializeCard(card: Card): SerializedCard {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.getTime() : null,
  };
}

export function deserializeCard(s: SerializedCard): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state as State,
    last_review: s.last_review === null ? undefined : new Date(s.last_review),
  };
}

/** Start of the next local calendar day + 4 hours. */
export function firstDueAfterSave(now: Date): number {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 4, 0, 0, 0);
  return d.getTime();
}

export function newCard(now: Date): SerializedCard {
  const card = serializeCard(createEmptyCard(now));
  return { ...card, due: firstDueAfterSave(now) };
}

export function reviewCard(card: SerializedCard, now: Date, rating: Rating): SerializedCard {
  const result = scheduler.next(deserializeCard(card), now, rating as Grade);
  return serializeCard(result.card);
}

/** Local calendar day as 'YYYY-MM-DD'. */
export function localDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
