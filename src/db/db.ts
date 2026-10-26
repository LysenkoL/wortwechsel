import Dexie, { type EntityTable } from 'dexie';
import type { Deck, Item, Review, Setting, UsageDay, Utterance, WordCard, WordLogEntry } from './types';

export class WortwechselDB extends Dexie {
  utterances!: EntityTable<Utterance, 'id'>;
  items!: EntityTable<Item, 'id'>;
  reviews!: EntityTable<Review, 'id'>;
  usage!: EntityTable<UsageDay, 'day'>;
  settings!: EntityTable<Setting, 'key'>;
  decks!: EntityTable<Deck, 'id'>;
  cards!: EntityTable<WordCard, 'id'>;
  wordLog!: EntityTable<WordLogEntry, 'id'>;

  constructor(name = 'wortwechsel') {
    super(name);
    this.version(1).stores({
      utterances: 'id, createdAt, context',
      items: 'id, utteranceId, due, stage, lemma',
      reviews: 'id, reviewedAt, utteranceId',
      usage: 'day',
      settings: 'key',
    });
    // T14: word sets. Additive — no data migration needed.
    this.version(2).stores({
      decks: 'id, createdAt, context',
      cards: 'id, deckId, due, sourceItemId',
      wordLog: 'id, at, cardId, deckId',
    });
  }
}

export const db = new WortwechselDB();
