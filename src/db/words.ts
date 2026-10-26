// Word sets (T14). Part of the DB layer: components import these through ./repo.
import { emptyStats, nextStats } from '../words/mastery';
import type { StarterDeck } from '../words/starters';
import { freshCard, localDay, reviewCard } from '../srs/scheduler';
import { db } from './db';
import type { Context, Deck, Item, Rating, StudyMode, WordCard } from './types';

const id = () => crypto.randomUUID();

export const DEFAULT_NEW_PER_DAY = 15;

function startOfDay(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

// ---------- decks ----------

export interface DeckInput {
  title: string;
  emoji: string;
  context: Context;
  description: string;
}

export async function createDeck(input: DeckInput, now: Date = new Date(), starterId: string | null = null): Promise<string> {
  const deck: Deck = {
    id: id(), createdAt: now.getTime(), updatedAt: now.getTime(),
    title: input.title.trim(), emoji: input.emoji || '📘', context: input.context,
    description: input.description.trim(), starterId, bestMatchMs: null,
  };
  await db.decks.add(deck);
  return deck.id;
}

export async function updateDeck(deckId: string, input: Partial<DeckInput>, now: Date = new Date()): Promise<void> {
  const patch: Partial<Deck> = { updatedAt: now.getTime() };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.emoji !== undefined) patch.emoji = input.emoji || '📘';
  if (input.context !== undefined) patch.context = input.context;
  if (input.description !== undefined) patch.description = input.description.trim();
  await db.decks.update(deckId, patch);
}

export async function deleteDeck(deckId: string): Promise<void> {
  await db.transaction('rw', db.decks, db.cards, db.wordLog, async () => {
    await db.cards.where('deckId').equals(deckId).delete();
    await db.wordLog.where('deckId').equals(deckId).delete();
    await db.decks.delete(deckId);
  });
}

export async function getDeck(deckId: string): Promise<Deck | undefined> {
  return db.decks.get(deckId);
}

export interface DeckSummary {
  deck: Deck;
  total: number;
  cards: Pick<WordCard, 'stats' | 'due' | 'card'>[];
}

export async function listDecks(): Promise<DeckSummary[]> {
  const [decks, cards] = await Promise.all([db.decks.toArray(), db.cards.toArray()]);
  const byDeck = new Map<string, WordCard[]>();
  for (const c of cards) byDeck.set(c.deckId, [...(byDeck.get(c.deckId) ?? []), c]);
  return decks
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((deck) => {
      const list = byDeck.get(deck.id) ?? [];
      return { deck, total: list.length, cards: list };
    });
}

export async function saveMatchTime(deckId: string, ms: number): Promise<boolean> {
  const deck = await db.decks.get(deckId);
  if (!deck) return false;
  if (deck.bestMatchMs !== null && deck.bestMatchMs <= ms) return false;
  await db.decks.update(deckId, { bestMatchMs: ms });
  return true;
}

// ---------- cards ----------

export interface CardInput {
  term: string;
  definition: string;
  example?: string;
  note?: string;
  emoji?: string;
  sourceItemId?: string | null;
}

function newWordCard(deckId: string, input: CardInput, now: Date): WordCard {
  // Unlike expressions (due tomorrow), a new word can be studied right away.
  const card = freshCard(now);
  return {
    id: id(), deckId, createdAt: now.getTime(),
    term: input.term.trim(), definition: input.definition.trim(),
    example: (input.example ?? '').trim(), note: (input.note ?? '').trim(),
    emoji: (input.emoji ?? '').trim(), starred: false, sourceItemId: input.sourceItemId ?? null,
    stats: emptyStats(), card, due: card.due,
  };
}

const key = (s: string) => s.trim().toLowerCase();

/** Adds cards, skipping empty terms and terms already in the deck. Returns how many were added. */
export async function addCards(deckId: string, inputs: CardInput[], now: Date = new Date()): Promise<number> {
  return db.transaction('rw', db.cards, db.decks, async () => {
    const existing = new Set((await db.cards.where('deckId').equals(deckId).toArray()).map((c) => key(c.term)));
    const fresh: WordCard[] = [];
    inputs.forEach((input, i) => {
      const k = key(input.term);
      if (!k || existing.has(k)) return;
      existing.add(k);
      // +i ms keeps the typed order stable when sorting by createdAt.
      fresh.push(newWordCard(deckId, input, new Date(now.getTime() + i)));
    });
    await db.cards.bulkAdd(fresh);
    if (fresh.length) await db.decks.update(deckId, { updatedAt: now.getTime() });
    return fresh.length;
  });
}

export async function addCardsFromItems(deckId: string, items: Item[], now: Date = new Date()): Promise<number> {
  return addCards(deckId, items.map((i) => ({
    term: i.lemma,
    definition: i.meaningRu,
    example: i.exampleDe,
    note: i.pattern !== i.lemma ? i.pattern : '',
    sourceItemId: i.id,
  })), now);
}

export async function listCards(deckId: string): Promise<WordCard[]> {
  const cards = await db.cards.where('deckId').equals(deckId).toArray();
  return cards.sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateCard(cardId: string, patch: Partial<Pick<WordCard, 'term' | 'definition' | 'example' | 'note' | 'emoji' | 'starred'>>): Promise<void> {
  const clean: typeof patch = { ...patch };
  for (const k of ['term', 'definition', 'example', 'note', 'emoji'] as const) {
    const v = clean[k];
    if (v !== undefined) clean[k] = v.trim();
  }
  await db.cards.update(cardId, clean);
}

export async function deleteCard(cardId: string): Promise<void> {
  await db.transaction('rw', db.cards, db.wordLog, async () => {
    await db.wordLog.where('cardId').equals(cardId).delete();
    await db.cards.delete(cardId);
  });
}

/** Clears training statistics of a deck ("начать заново"); FSRS state is kept. */
export async function resetDeckStats(deckId: string): Promise<void> {
  await db.cards.where('deckId').equals(deckId).modify((c) => { c.stats = emptyStats(); });
}

// ---------- answers ----------

/** One answer in any training mode (except "Повторение", see reviewWord). */
export async function recordAnswer(cardId: string, mode: StudyMode, correct: boolean, now: Date = new Date()): Promise<void> {
  await db.transaction('rw', db.cards, db.wordLog, async () => {
    const card = await db.cards.get(cardId);
    if (!card) return;
    await db.cards.update(cardId, { stats: nextStats(card.stats, correct, now.getTime()) });
    await db.wordLog.add({
      id: id(), cardId, deckId: card.deckId, at: now.getTime(), mode, correct, rating: null, wasNew: false,
    });
  });
}

/** Spaced repetition answer: FSRS + statistics. */
export async function reviewWord(cardId: string, rating: Rating, now: Date = new Date()): Promise<void> {
  await db.transaction('rw', db.cards, db.wordLog, async () => {
    const card = await db.cards.get(cardId);
    if (!card) return;
    const wasNew = card.card.reps === 0;
    const next = reviewCard(card.card, now, rating);
    const correct = rating >= 3;
    await db.cards.update(cardId, { card: next, due: next.due, stats: nextStats(card.stats, correct, now.getTime()) });
    await db.wordLog.add({
      id: id(), cardId, deckId: card.deckId, at: now.getTime(), mode: 'review', correct, rating, wasNew,
    });
  });
}

/** Spaced repetition queue: all due cards already in review + new cards up to today's limit. */
export async function getWordReviewQueue(
  now: Date, newPerDay: number, deckId?: string,
): Promise<WordCard[]> {
  const t = now.getTime();
  // Whole table (not a `due <= now` range): live queries must also notice cards added later.
  const all = deckId ? await db.cards.where('deckId').equals(deckId).toArray() : await db.cards.toArray();
  const dueSeen = all.filter((c) => c.card.reps > 0 && c.due <= t).sort((a, b) => a.due - b.due);
  const newLeft = Math.max(0, newPerDay - (await newReviewedToday(now)));
  const fresh = all.filter((c) => c.card.reps === 0 && c.term && c.definition).sort((a, b) => a.createdAt - b.createdAt).slice(0, newLeft);
  return [...dueSeen, ...fresh];
}

export async function newReviewedToday(now: Date = new Date()): Promise<number> {
  const entries = await db.wordLog.where('at').aboveOrEqual(startOfDay(now)).toArray();
  return entries.filter((e) => e.mode === 'review' && e.wasNew).length;
}

export async function countWordsDue(now: Date, newPerDay: number): Promise<number> {
  return (await getWordReviewQueue(now, newPerDay)).length;
}

export interface WordDayStats { answers: number; correct: number; streakDays: number }

/** Today's answers and how many days in a row (up to today) had at least one answer. */
export async function wordStats(now: Date = new Date()): Promise<WordDayStats> {
  const since = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60));
  const entries = await db.wordLog.where('at').aboveOrEqual(since).toArray();
  const today = localDay(now);
  const days = new Set(entries.map((e) => localDay(new Date(e.at))));
  const todays = entries.filter((e) => localDay(new Date(e.at)) === today);
  let streakDays = 0;
  for (let i = days.has(today) ? 0 : 1; ; i++) {
    const d = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    if (!days.has(d)) break;
    streakDays += 1;
  }
  return { answers: todays.length, correct: todays.filter((e) => e.correct).length, streakDays };
}

// ---------- starter decks ----------

export async function addStarterDeck(starter: StarterDeck, now: Date = new Date()): Promise<string> {
  // One transaction: the list never shows the new deck without its cards.
  return db.transaction('rw', db.decks, db.cards, async () => {
    const existing = await db.decks.filter((d) => d.starterId === starter.id).first();
    if (existing) return existing.id;
    const deckId = await createDeck(
      { title: starter.title, emoji: starter.emoji, context: starter.context, description: starter.description },
      now, starter.id,
    );
    await addCards(deckId, starter.cards, now);
    return deckId;
  });
}

/** Starter decks added before cards had emoji: take the emoji from the starter data (once, by term). */
export async function backfillStarterEmoji(starters: StarterDeck[]): Promise<number> {
  return db.transaction('rw', db.decks, db.cards, async () => {
    let n = 0;
    for (const deck of await db.decks.filter((d) => d.starterId !== null).toArray()) {
      const starter = starters.find((s) => s.id === deck.starterId);
      if (!starter) continue;
      const byTerm = new Map(starter.cards.map((c) => [c.term.toLowerCase(), c.emoji]));
      for (const card of await db.cards.where('deckId').equals(deck.id).toArray()) {
        const emoji = byTerm.get(card.term.toLowerCase());
        if (card.emoji || !emoji) continue;
        await db.cards.update(card.id, { emoji });
        n++;
      }
    }
    return n;
  });
}
