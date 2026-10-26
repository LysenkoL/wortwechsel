import { db } from './db';
import * as repo from './repo';
import type { AnalyzeResponse, EvaluateResponse, Suggestion } from '../ai/contracts.generated';

const sug = (over: Partial<Suggestion> = {}): Suggestion => ({
  original: 'gesagt', replacement: 'klargemacht', lemma: 'klarmachen', pattern: 'jdm. klarmachen, dass …',
  meaning_ru: 'ясно дать понять', note_ru: 'note', register: 'neutral', example_de: 'Beispiel.', ...over,
});
const analysis = (suggestions: Suggestion[]): AnalyzeResponse => ({
  is_german: true, corrected_sentence: '', grammar_notes: [], suggestions, keep: [],
  improved_sentence: 'x', generic_words: [],
});
const input = (suggestions: Suggestion[]) => ({
  context: 'work' as const, question: null, rawTranscript: 'raw', transcript: 'Er hat gesagt, dass wir das anders machen müssen.',
  analysis: analysis(suggestions),
});
const evaluation = (targets: EvaluateResponse['targets'], over: Partial<EvaluateResponse> = {}): EvaluateResponse => ({
  meaning_preserved: true, targets, naturalness: 'natural', errors: [], better_version: 'b', feedback_ru: 'f', ...over,
});
const ok = (id: string) => ({ id, used: true, correct: true, comment_ru: '' });

const D = (day: number, h = 10) => new Date(2026, 9, day, h, 0);

beforeEach(async () => {
  await Promise.all([db.utterances.clear(), db.items.clear(), db.reviews.clear(), db.usage.clear(), db.settings.clear()]);
});

describe('saveUtterance', () => {
  it('creates an utterance and learning items due tomorrow at 04:00', async () => {
    const { utteranceId, itemIds } = await repo.saveUtterance(input([sug(), sug({ lemma: 'vorgehen', replacement: 'anders vorgehen' })]), [sug(), sug({ lemma: 'vorgehen', replacement: 'anders vorgehen' })], D(25));
    expect(itemIds).toHaveLength(2);
    const items = await repo.listItems();
    expect(items.every((i) => i.stage === 'learning' && i.utteranceId === utteranceId)).toBe(true);
    expect(new Date(items[0].due).getDate()).toBe(26);
    expect(new Date(items[0].due).getHours()).toBe(4);
    expect(items[0].due).toBe(items[0].card.due);
  });

  it('does not create a duplicate for the same lemma + replacement', async () => {
    const first = await repo.saveUtterance(input([sug()]), [sug()], D(25));
    const second = await repo.saveUtterance(input([sug()]), [sug()], D(25, 12));
    expect(second.itemIds).toEqual(first.itemIds);
    expect(await db.items.count()).toBe(1);
    expect(await db.utterances.count()).toBe(2);
  });

  it('creates a new item when the old one is suspended', async () => {
    const first = await repo.saveUtterance(input([sug()]), [sug()], D(25));
    await repo.setItemStage(first.itemIds[0], 'suspended');
    const second = await repo.saveUtterance(input([sug()]), [sug()], D(25, 12));
    expect(second.itemIds[0]).not.toBe(first.itemIds[0]);
  });

  it('saves an utterance with no selected suggestions', async () => {
    const r = await repo.saveUtterance(input([]), [], D(25));
    expect(r.itemIds).toEqual([]);
    expect(await db.utterances.count()).toBe(1);
  });
});

describe('getDueGroups / countDue', () => {
  it('returns only due, non-suspended items grouped by utterance, oldest first', async () => {
    const a = await repo.saveUtterance(input([sug()]), [sug(), sug({ lemma: 'vorgehen', replacement: 'vor' })], D(20));
    const b = await repo.saveUtterance(input([sug({ lemma: 'erledigen', replacement: 'erledigt' })]), [sug({ lemma: 'erledigen', replacement: 'erledigt' })], D(21));
    await repo.saveUtterance(input([sug({ lemma: 'guttun', replacement: 'gutgetan' })]), [sug({ lemma: 'guttun', replacement: 'gutgetan' })], D(25)); // due 26th

    const groups = await repo.getDueGroups(D(24), 20);
    expect(groups.map((g) => g.utterance.id)).toEqual([a.utteranceId, b.utteranceId]);
    expect(groups[0].items).toHaveLength(2);
    expect(await repo.countDue(D(24))).toBe(3);

    await repo.setItemStage(a.itemIds[0], 'suspended');
    expect(await repo.countDue(D(24))).toBe(2);
  });

  it('never cuts a group to fit the limit', async () => {
    await repo.saveUtterance(input([]), [sug(), sug({ lemma: 'vorgehen', replacement: 'vor' })], D(20));
    await repo.saveUtterance(input([]), [sug({ lemma: 'erledigen', replacement: 'erledigt' })], D(21));
    const groups = await repo.getDueGroups(D(24), 2);
    expect(groups.map((g) => g.items.length)).toEqual([2]);
    expect((await repo.getDueGroups(D(24), 1)).map((g) => g.items.length)).toEqual([1]);
    expect(await repo.getDueGroups(D(24), 0)).toEqual([]);
  });
});

describe('applyReview', () => {
  it('Good moves the due date forward and records the day', async () => {
    const { utteranceId, itemIds } = await repo.saveUtterance(input([sug()]), [sug()], D(20));
    const [item] = await repo.listItems();
    const res = await repo.applyReview(
      { utteranceId, items: [item], kind: 'rephrase', answerTranscript: 'a', hintUsed: false, evaluation: evaluation([ok(itemIds[0])]), easyTapped: false },
      D(21, 9),
    );
    expect(res.ratings[itemIds[0]]).toBe(3);
    const after = (await repo.listItems())[0];
    expect(after.due).toBeGreaterThan(D(21, 9).getTime());
    expect(after.correctDays).toEqual(['2026-10-21']);
    expect(await db.reviews.count()).toBe(1);
  });

  it('Again does not add a correct day', async () => {
    const { utteranceId, itemIds } = await repo.saveUtterance(input([sug()]), [sug()], D(20));
    const [item] = await repo.listItems();
    await repo.applyReview(
      { utteranceId, items: [item], kind: 'rephrase', answerTranscript: '', hintUsed: false, evaluation: evaluation([{ id: itemIds[0], used: false, correct: false, comment_ru: '' }]), easyTapped: false },
      D(21, 9),
    );
    expect((await repo.listItems())[0].correctDays).toEqual([]);
  });

  it('two Good answers on the same day count once', async () => {
    const { utteranceId, itemIds } = await repo.saveUtterance(input([sug()]), [sug()], D(20));
    for (const h of [9, 10]) {
      const [item] = await repo.listItems();
      await repo.applyReview({ utteranceId, items: [item], kind: 'rephrase', answerTranscript: '', hintUsed: false, evaluation: evaluation([ok(itemIds[0])]), easyTapped: false }, D(21, h));
    }
    expect((await repo.listItems())[0].correctDays).toEqual(['2026-10-21']);
  });

  it('three Good answers on different days make the item active', async () => {
    const { utteranceId, itemIds } = await repo.saveUtterance(input([sug()]), [sug()], D(10));
    let activated: string[] = [];
    for (const day of [11, 14, 20]) {
      const [item] = await repo.listItems();
      ({ activatedItemIds: activated } = await repo.applyReview({ utteranceId, items: [item], kind: 'rephrase', answerTranscript: '', hintUsed: false, evaluation: evaluation([ok(itemIds[0])]), easyTapped: false }, D(day, 9)));
    }
    expect((await repo.listItems())[0].stage).toBe('active');
    expect(activated).toEqual([itemIds[0]]);
  });

  it('a suspended item is never activated', async () => {
    const { utteranceId, itemIds } = await repo.saveUtterance(input([sug()]), [sug()], D(10));
    await repo.setItemStage(itemIds[0], 'suspended');
    for (const day of [11, 14, 20]) {
      const [item] = await repo.listItems();
      await repo.applyReview({ utteranceId, items: [item], kind: 'rephrase', answerTranscript: '', hintUsed: false, evaluation: evaluation([ok(itemIds[0])]), easyTapped: false }, D(day, 9));
    }
    expect((await repo.listItems())[0].stage).toBe('suspended');
  });

  it('throws when the evaluation misses a target', async () => {
    const { utteranceId } = await repo.saveUtterance(input([sug()]), [sug()], D(20));
    const [item] = await repo.listItems();
    await expect(
      repo.applyReview({ utteranceId, items: [item], kind: 'rephrase', answerTranscript: '', hintUsed: false, evaluation: evaluation([]), easyTapped: false }, D(21)),
    ).rejects.toThrow();
    expect(await db.reviews.count()).toBe(0);
  });

  it('reviewedTodayCount counts items reviewed today only', async () => {
    const { utteranceId, itemIds } = await repo.saveUtterance(input([sug()]), [sug(), sug({ lemma: 'vorgehen', replacement: 'vor' })], D(20));
    const items = await repo.listItems();
    const ev = evaluation(items.map((i) => ok(i.id)));
    await repo.applyReview({ utteranceId, items, kind: 'rephrase', answerTranscript: '', hintUsed: false, evaluation: ev, easyTapped: false }, D(21, 9));
    expect(itemIds).toHaveLength(2);
    expect(await repo.reviewedTodayCount(D(21, 18))).toBe(2);
    expect(await repo.reviewedTodayCount(D(22, 8))).toBe(0);
  });
});

describe('makeAllDueNow', () => {
  it('makes future items due, skips suspended ones', async () => {
    const { itemIds } = await repo.saveUtterance(input([]), [sug(), sug({ lemma: 'vorgehen', replacement: 'vor' })], D(25));
    await repo.setItemStage(itemIds[1], 'suspended');
    expect(await repo.countDue(D(25, 11))).toBe(0);
    await repo.makeAllDueNow(D(25, 11));
    expect(await repo.countDue(D(25, 11))).toBe(1);
  });
});

describe('export / import', () => {
  it('round-trips with replace', async () => {
    const { utteranceId, itemIds } = await repo.saveUtterance(input([sug()]), [sug()], D(20));
    const [item] = await repo.listItems();
    await repo.applyReview({ utteranceId, items: [item], kind: 'rephrase', answerTranscript: 'a', hintUsed: false, evaluation: evaluation([ok(itemIds[0])]), easyTapped: false }, D(21));
    await repo.setSetting('apiKey', 'SECRET');
    const file = await repo.exportAll(D(22));
    expect(JSON.stringify(file)).not.toContain('SECRET');
    expect('settings' in file).toBe(false);

    await Promise.all([db.utterances.clear(), db.items.clear(), db.reviews.clear()]);
    const counts = await repo.importAll(JSON.parse(JSON.stringify(file)), 'replace');
    expect(counts).toEqual({ utterances: 1, items: 1, reviews: 1, decks: 0, cards: 0 });
    expect(await repo.exportAll(D(22))).toEqual(file);
  });

  it('merge does not create duplicates and keeps the more advanced item', async () => {
    const { utteranceId, itemIds } = await repo.saveUtterance(input([sug()]), [sug()], D(20));
    const older = await repo.exportAll(D(20));
    const [item] = await repo.listItems();
    await repo.applyReview({ utteranceId, items: [item], kind: 'rephrase', answerTranscript: '', hintUsed: false, evaluation: evaluation([ok(itemIds[0])]), easyTapped: false }, D(21));

    await repo.importAll(older, 'merge');
    expect(await db.items.count()).toBe(1);
    expect((await repo.listItems())[0].correctDays).toEqual(['2026-10-21']);

    const newer = await repo.exportAll(D(22));
    await Promise.all([db.utterances.clear(), db.items.clear(), db.reviews.clear()]);
    await repo.importAll(older, 'merge');
    await repo.importAll(newer, 'merge');
    expect((await repo.listItems())[0].correctDays).toEqual(['2026-10-21']);
  });

  it('rejects foreign or broken files', async () => {
    await expect(repo.importAll({ app: 'other' }, 'replace')).rejects.toThrow(repo.ImportError);
    await expect(repo.importAll({ app: 'wortwechsel', version: 1 }, 'merge')).rejects.toThrow(repo.ImportError);
    await expect(repo.importAll(null, 'merge')).rejects.toThrow(repo.ImportError);
  });
});

describe('usage & settings', () => {
  it('counts usage per day and kind', async () => {
    await repo.incrementUsage('analyze', D(25));
    await repo.incrementUsage('analyze', D(25, 15));
    await repo.incrementUsage('evaluate', D(25, 16));
    await repo.incrementUsage('analyze', D(26));
    expect(await repo.getUsage('2026-10-25', '2026-10-25')).toEqual([{ day: '2026-10-25', analyze: 2, evaluate: 1 }]);
    expect(await repo.getUsage('2026-10-01', '2026-10-31')).toHaveLength(2);
  });

  it('returns the fallback for missing settings', async () => {
    expect(await repo.getSetting('x', 7)).toBe(7);
    await repo.setSetting('x', 9);
    expect(await repo.getSetting('x', 7)).toBe(9);
  });
});
