// The ONLY module that talks to IndexedDB (architecture §4).
import type { AnalyzeResponse, EvaluateResponse, Suggestion } from '../ai/contracts.generated';
import { rateTarget } from '../srs/rating';
import { localDay, newCard, reviewCard } from '../srs/scheduler';
import { db } from './db';
import type {
  Context, DueGroup, ExportFile, ExportFileV1, Item, Rating, Review, Stage, Utterance, WordCard,
} from './types';

export * from './words';

const ACTIVE_AFTER_DAYS = 3;
const id = () => crypto.randomUUID();

function startOfDay(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

// ---------- utterances & items ----------

export interface SaveUtteranceInput {
  context: Context;
  question: string | null;
  rawTranscript: string;
  transcript: string;
  analysis: AnalyzeResponse;
}

export async function saveUtterance(
  input: SaveUtteranceInput,
  selected: Suggestion[],
  now: Date = new Date(),
): Promise<{ utteranceId: string; itemIds: string[] }> {
  return db.transaction('rw', db.utterances, db.items, async () => {
    const utteranceId = id();
    await db.utterances.add({ id: utteranceId, createdAt: now.getTime(), ...input });

    const itemIds: string[] = [];
    for (const s of selected) {
      const existing = await db.items
        .where('lemma').equals(s.lemma)
        .filter((i) => i.replacement === s.replacement && i.stage !== 'suspended')
        .first();
      if (existing) {
        itemIds.push(existing.id);
        continue;
      }
      const card = newCard(now);
      const item: Item = {
        id: id(),
        utteranceId,
        createdAt: now.getTime(),
        original: s.original,
        replacement: s.replacement,
        lemma: s.lemma,
        pattern: s.pattern,
        meaningRu: s.meaning_ru,
        noteRu: s.note_ru,
        register: s.register,
        exampleDe: s.example_de,
        card,
        due: card.due,
        correctDays: [],
        stage: 'learning',
      };
      await db.items.add(item);
      itemIds.push(item.id);
    }
    return { utteranceId, itemIds };
  });
}

export async function countDue(now: Date = new Date()): Promise<number> {
  return db.items.where('due').belowOrEqual(now.getTime()).filter((i) => i.stage !== 'suspended').count();
}

export async function getDueGroups(now: Date, limit: number): Promise<DueGroup[]> {
  if (limit <= 0) return [];
  const due = await db.items
    .where('due').belowOrEqual(now.getTime())
    .filter((i) => i.stage !== 'suspended')
    .toArray();

  const byUtterance = new Map<string, Item[]>();
  for (const item of due) {
    const list = byUtterance.get(item.utteranceId) ?? [];
    list.push(item);
    byUtterance.set(item.utteranceId, list);
  }

  const groups = [...byUtterance.entries()]
    .map(([utteranceId, items]) => ({ utteranceId, items, first: Math.min(...items.map((i) => i.due)) }))
    .sort((a, b) => a.first - b.first);

  const result: DueGroup[] = [];
  let total = 0;
  for (const g of groups) {
    if (total + g.items.length > limit) continue; // a group is never cut
    const utterance = await db.utterances.get(g.utteranceId);
    if (!utterance) continue; // orphaned item
    result.push({ utterance, items: g.items.sort((a, b) => a.createdAt - b.createdAt) });
    total += g.items.length;
  }
  return result;
}

export interface ApplyReviewInput {
  utteranceId: string;
  items: Item[];
  kind: Review['kind'];
  answerTranscript: string;
  hintUsed: boolean;
  evaluation: EvaluateResponse;
  easyTapped: boolean;
}

export async function applyReview(
  input: ApplyReviewInput,
  now: Date = new Date(),
): Promise<{ ratings: Record<string, Rating>; activatedItemIds: string[] }> {
  return db.transaction('rw', db.items, db.reviews, async () => {
    const ratings: Record<string, Rating> = {};
    const activated: string[] = [];
    const today = localDay(now);

    for (const passed of input.items) {
      const result = input.evaluation.targets.find((t) => t.id === passed.id);
      if (!result) throw new Error(`Evaluation has no result for item ${passed.id}`);
      const item = await db.items.get(passed.id); // fresh copy
      if (!item) continue; // deleted meanwhile

      const rating = rateTarget(result, {
        hintUsed: input.hintUsed,
        meaningPreserved: input.evaluation.meaning_preserved,
        naturalness: input.evaluation.naturalness,
        easyTapped: input.easyTapped,
      });
      ratings[item.id] = rating;

      const card = reviewCard(item.card, now, rating);
      const correctDays =
        rating >= 3 && !item.correctDays.includes(today) ? [...item.correctDays, today] : item.correctDays;
      let stage: Stage = item.stage;
      if (stage === 'learning' && correctDays.length >= ACTIVE_AFTER_DAYS) {
        stage = 'active';
        activated.push(item.id);
      }
      await db.items.update(item.id, { card, due: card.due, correctDays, stage });
    }

    await db.reviews.add({
      id: id(),
      utteranceId: input.utteranceId,
      itemIds: input.items.map((i) => i.id),
      kind: input.kind,
      reviewedAt: now.getTime(),
      answerTranscript: input.answerTranscript,
      hintUsed: input.hintUsed,
      evaluation: input.evaluation,
      ratings,
    });
    return { ratings, activatedItemIds: activated };
  });
}

/** How many items were already reviewed today (for the daily limit). */
export async function reviewedTodayCount(now: Date = new Date()): Promise<number> {
  const reviews = await db.reviews.where('reviewedAt').aboveOrEqual(startOfDay(now)).toArray();
  return reviews.reduce((sum, r) => sum + r.itemIds.length, 0);
}

/** Earliest due time among items that are still being learned/kept, or null. */
export async function nextDueAt(): Promise<number | null> {
  const first = await db.items.orderBy('due').filter((i) => i.stage !== 'suspended').first();
  return first ? first.due : null;
}

export async function listItems(stage?: Stage): Promise<Item[]> {
  const items = stage ? await db.items.where('stage').equals(stage).toArray() : await db.items.toArray();
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function countItems(): Promise<number> {
  return db.items.count();
}

export async function getUtterance(utteranceId: string): Promise<Utterance | undefined> {
  return db.utterances.get(utteranceId);
}

export async function setItemStage(itemId: string, stage: Stage): Promise<void> {
  await db.items.update(itemId, { stage });
}

export async function deleteItem(itemId: string): Promise<void> {
  await db.items.delete(itemId);
}

/** Debug only: make every non-suspended item due right now. */
export async function makeAllDueNow(now: Date = new Date()): Promise<void> {
  const t = now.getTime();
  await db.transaction('rw', db.items, async () => {
    await db.items.toCollection().modify((item) => {
      if (item.stage === 'suspended') return;
      item.due = t;
      item.card.due = t;
    });
  });
}

// ---------- export / import ----------

export async function exportAll(now: Date = new Date()): Promise<ExportFile> {
  // Settings (and therefore the API key) are intentionally NOT exported.
  const [utterances, items, reviews, decks, cards, wordLog] = await Promise.all([
    db.utterances.toArray(), db.items.toArray(), db.reviews.toArray(),
    db.decks.toArray(), db.cards.toArray(), db.wordLog.toArray(),
  ]);
  return { app: 'wortwechsel', version: 2, exportedAt: now.getTime(), utterances, items, reviews, decks, cards, wordLog };
}

export class ImportError extends Error {}

/** Accepts backup version 1 (before word sets) and 2; returns a version-2 shape. */
function readExportFile(file: unknown): ExportFile {
  const f = file as Partial<ExportFile> | Partial<ExportFileV1> | null;
  if (!f || f.app !== 'wortwechsel' || (f.version !== 1 && f.version !== 2)) {
    throw new ImportError('Это не файл резервной копии Wortwechsel.');
  }
  if (!Array.isArray(f.utterances) || !Array.isArray(f.items) || !Array.isArray(f.reviews)) {
    throw new ImportError('Файл повреждён: нет списков фраз, выражений или повторений.');
  }
  if (f.version === 1) return { ...(f as ExportFileV1), version: 2, decks: [], cards: [], wordLog: [] };
  const v2 = f as Partial<ExportFile>;
  if (!Array.isArray(v2.decks) || !Array.isArray(v2.cards) || !Array.isArray(v2.wordLog)) {
    throw new ImportError('Файл повреждён: нет списков наборов или карточек.');
  }
  return v2 as ExportFile;
}

const itemUpdatedAt = (i: Item) => Math.max(i.createdAt, i.card.last_review ?? 0);
const cardUpdatedAt = (c: WordCard) => Math.max(c.createdAt, c.stats.lastAt ?? 0, c.card.last_review ?? 0);

export async function importAll(
  raw: unknown,
  mode: 'replace' | 'merge',
): Promise<{ utterances: number; items: number; reviews: number; decks: number; cards: number }> {
  const file = readExportFile(raw);
  const tables = [db.utterances, db.items, db.reviews, db.decks, db.cards, db.wordLog];
  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      await Promise.all(tables.map((t) => t.clear()));
      await db.utterances.bulkPut(file.utterances);
      await db.items.bulkPut(file.items);
      await db.reviews.bulkPut(file.reviews);
      await db.decks.bulkPut(file.decks);
      await db.cards.bulkPut(file.cards);
      await db.wordLog.bulkPut(file.wordLog);
      return;
    }
    for (const d of file.decks) {
      const cur = await db.decks.get(d.id);
      if (!cur || d.updatedAt > cur.updatedAt) await db.decks.put(d);
    }
    for (const c of file.cards) {
      const cur = await db.cards.get(c.id);
      if (!cur || cardUpdatedAt(c) > cardUpdatedAt(cur)) await db.cards.put(c);
    }
    const knownLog = new Set((await db.wordLog.toArray()).map((e) => e.id));
    await db.wordLog.bulkPut(file.wordLog.filter((e) => !knownLog.has(e.id)));
    for (const u of file.utterances) {
      const cur = await db.utterances.get(u.id);
      if (!cur || u.createdAt > cur.createdAt) await db.utterances.put(u);
    }
    for (const i of file.items) {
      const cur = await db.items.get(i.id);
      if (!cur || itemUpdatedAt(i) > itemUpdatedAt(cur)) await db.items.put(i);
    }
    for (const r of file.reviews) {
      const cur = await db.reviews.get(r.id);
      if (!cur || r.reviewedAt > cur.reviewedAt) await db.reviews.put(r);
    }
  });
  return {
    utterances: file.utterances.length, items: file.items.length, reviews: file.reviews.length,
    decks: file.decks.length, cards: file.cards.length,
  };
}

// ---------- usage & settings ----------

export async function incrementUsage(kind: 'analyze' | 'evaluate' | 'generate', now: Date = new Date()): Promise<void> {
  const day = localDay(now);
  await db.transaction('rw', db.usage, async () => {
    const cur = (await db.usage.get(day)) ?? { day, analyze: 0, evaluate: 0 };
    cur[kind] = (cur[kind] ?? 0) + 1;
    await db.usage.put(cur);
  });
}

export async function getUsage(fromDay: string, toDay: string) {
  return db.usage.where('day').between(fromDay, toDay, true, true).toArray();
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}
