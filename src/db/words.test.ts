import { db } from './db';
import * as repo from './repo';
import { STARTER_DECKS } from '../words/starters';
import type { Item } from './types';

const D = (day: number, h = 10) => new Date(2026, 9, day, h, 0);
const deckInput = { title: ' Meetings ', emoji: '💼', context: 'work' as const, description: '' };

beforeEach(async () => {
  await Promise.all([db.decks.clear(), db.cards.clear(), db.wordLog.clear(), db.items.clear(), db.utterances.clear(), db.reviews.clear()]);
});

describe('decks and cards', () => {
  it('creates a deck, adds cards in order, skips empty and duplicate terms', async () => {
    const deckId = await repo.createDeck(deckInput, D(1));
    const n = await repo.addCards(deckId, [
      { term: 'der Antrag', definition: 'заявление' },
      { term: '  ', definition: 'x' },
      { term: 'Der Antrag', definition: 'дубль' },
      { term: 'die Frist ', definition: ' срок ', example: 'Die Frist ist kurz.' },
    ], D(1));
    expect(n).toBe(2);
    expect(await repo.addCards(deckId, [{ term: 'die frist', definition: '' }])).toBe(0);
    const cards = await repo.listCards(deckId);
    expect(cards.map((c) => c.term)).toEqual(['der Antrag', 'die Frist']);
    expect(cards[1]).toMatchObject({ definition: 'срок', example: 'Die Frist ist kurz.', note: '', starred: false });
    expect(cards[0].due).toBeLessThanOrEqual(D(1).getTime()); // studyable right away
    expect((await repo.getDeck(deckId))?.title).toBe('Meetings');
  });

  it('lists decks with their cards; deleting a deck removes cards and log', async () => {
    const a = await repo.createDeck(deckInput, D(1));
    const b = await repo.createDeck({ ...deckInput, title: 'B' }, D(2));
    await repo.addCards(a, [{ term: 'eins', definition: '1' }, { term: 'zwei', definition: '2' }]);
    const [card] = await repo.listCards(a);
    await repo.recordAnswer(card.id, 'write', true);
    const list = await repo.listDecks();
    expect(list.map((s) => [s.deck.title, s.total])).toEqual([['Meetings', 2], ['B', 0]]); // a got updatedAt from addCards
    await repo.deleteDeck(a);
    expect(await db.cards.count()).toBe(0);
    expect(await db.wordLog.count()).toBe(0);
    expect((await repo.listDecks()).map((s) => s.deck.id)).toEqual([b]);
  });

  it('copies expressions with their pattern as a note', async () => {
    const deckId = await repo.createDeck(deckInput);
    const item = { id: 'i1', lemma: 'klarmachen', meaningRu: 'ясно дать понять', exampleDe: 'Sie hat es klargemacht.', pattern: 'jdm. klarmachen, dass …' } as Item;
    await repo.addCardsFromItems(deckId, [item]);
    const [c] = await repo.listCards(deckId);
    expect(c).toMatchObject({ term: 'klarmachen', definition: 'ясно дать понять', note: 'jdm. klarmachen, dass …', sourceItemId: 'i1' });
  });

  it('adds a starter deck once', async () => {
    const s = STARTER_DECKS[0];
    const id1 = await repo.addStarterDeck(s);
    const id2 = await repo.addStarterDeck(s);
    expect(id1).toBe(id2);
    expect(await repo.listCards(id1)).toHaveLength(s.cards.length);
    expect((await repo.getDeck(id1))?.starterId).toBe(s.id);
  });

  it('starter decks are complete and have no duplicate terms', () => {
    for (const s of STARTER_DECKS) {
      expect(['work', 'daily', 'office', 'free']).toContain(s.context);
      for (const c of s.cards) expect(c.term && c.definition && c.example).toBeTruthy();
      expect(new Set(s.cards.map((c) => c.term.toLowerCase())).size).toBe(s.cards.length);
    }
  });

  it('keeps the best match time', async () => {
    const id = await repo.createDeck(deckInput);
    expect(await repo.saveMatchTime(id, 20_000)).toBe(true);
    expect(await repo.saveMatchTime(id, 25_000)).toBe(false);
    expect(await repo.saveMatchTime(id, 15_000)).toBe(true);
    expect((await repo.getDeck(id))?.bestMatchMs).toBe(15_000);
  });
});

describe('answers and spaced repetition', () => {
  async function deckWith(n: number, now = D(1)) {
    const deckId = await repo.createDeck(deckInput, now);
    await repo.addCards(deckId, Array.from({ length: n }, (_, i) => ({ term: `Wort${i}`, definition: `слово${i}` })), now);
    return { deckId, cards: await repo.listCards(deckId) };
  }

  it('recordAnswer updates stats and the log, but not FSRS', async () => {
    const { cards } = await deckWith(1);
    await repo.recordAnswer(cards[0].id, 'learn', true, D(2));
    await repo.recordAnswer(cards[0].id, 'learn', false, D(2, 11));
    const c = (await repo.listCards(cards[0].deckId))[0];
    expect(c.stats).toEqual({ seen: 2, correct: 1, wrong: 1, streak: 0, lastAt: D(2, 11).getTime() });
    expect(c.card.reps).toBe(0);
    expect(await db.wordLog.count()).toBe(2);
  });

  it('queue: new cards limited per day, reviewed ones come back when due', async () => {
    const { deckId, cards } = await deckWith(5);
    const q1 = await repo.getWordReviewQueue(D(2), 3);
    expect(q1.map((c) => c.id)).toEqual(cards.slice(0, 3).map((c) => c.id));

    await repo.reviewWord(cards[0].id, 3, D(2));
    await repo.reviewWord(cards[1].id, 1, D(2));
    expect(await repo.newReviewedToday(D(2, 12))).toBe(2);
    // 2 of 3 new used today; the two reviewed cards are not due yet (no short-term steps).
    const q2 = await repo.getWordReviewQueue(D(2, 12), 3);
    expect(q2.map((c) => c.id)).toEqual([cards[2].id]);

    // Next day: "Снова" card is due again, plus fresh new cards.
    const q3 = await repo.getWordReviewQueue(D(3, 12), 3, deckId);
    expect(q3[0].id).toBe(cards[1].id);
    expect(q3.filter((c) => c.card.reps === 0)).toHaveLength(3);
    expect(await repo.countWordsDue(D(3, 12), 3)).toBe(q3.length);
  });

  it('wordStats counts today and the streak of days', async () => {
    const { cards } = await deckWith(1);
    await repo.recordAnswer(cards[0].id, 'write', true, D(3));
    await repo.recordAnswer(cards[0].id, 'write', true, D(4));
    await repo.recordAnswer(cards[0].id, 'write', false, D(5));
    expect(await repo.wordStats(D(5, 20))).toEqual({ answers: 1, correct: 0, streakDays: 3 });
    expect((await repo.wordStats(D(6, 9))).streakDays).toBe(3); // today not started yet
    expect((await repo.wordStats(D(8))).streakDays).toBe(0);
  });

  it('resetDeckStats clears progress', async () => {
    const { deckId, cards } = await deckWith(1);
    await repo.recordAnswer(cards[0].id, 'write', true);
    await repo.resetDeckStats(deckId);
    expect((await repo.listCards(deckId))[0].stats.seen).toBe(0);
  });
});

describe('backup with word sets', () => {
  it('exports version 2 and round-trips decks, cards and log', async () => {
    const deckId = await repo.createDeck(deckInput, D(1));
    await repo.addCards(deckId, [{ term: 'eins', definition: '1' }], D(1));
    const [c] = await repo.listCards(deckId);
    await repo.reviewWord(c.id, 3, D(2));
    const file = await repo.exportAll(D(3));
    expect(file.version).toBe(2);
    await Promise.all([db.decks.clear(), db.cards.clear(), db.wordLog.clear()]);
    const counts = await repo.importAll(JSON.parse(JSON.stringify(file)), 'replace');
    expect(counts).toMatchObject({ decks: 1, cards: 1 });
    expect(await repo.exportAll(D(3))).toEqual(file);
  });

  it('merge keeps the more recently studied card and does not duplicate the log', async () => {
    const deckId = await repo.createDeck(deckInput, D(1));
    await repo.addCards(deckId, [{ term: 'eins', definition: '1' }], D(1));
    const [c] = await repo.listCards(deckId);
    const older = await repo.exportAll(D(1));
    await repo.recordAnswer(c.id, 'write', true, D(5));
    const newer = await repo.exportAll(D(5));
    await repo.importAll(older, 'merge');
    expect((await repo.listCards(deckId))[0].stats.seen).toBe(1);
    await repo.importAll(newer, 'merge');
    expect(await db.wordLog.count()).toBe(1);
  });

  it('still imports version-1 files', async () => {
    const counts = await repo.importAll({ app: 'wortwechsel', version: 1, exportedAt: 0, utterances: [], items: [], reviews: [] }, 'merge');
    expect(counts).toEqual({ utterances: 0, items: 0, reviews: 0, decks: 0, cards: 0 });
    await expect(repo.importAll({ app: 'wortwechsel', version: 2, utterances: [], items: [], reviews: [] }, 'merge')).rejects.toThrow(repo.ImportError);
  });
});
