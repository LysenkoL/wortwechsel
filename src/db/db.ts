import Dexie, { type EntityTable } from 'dexie';
import type { Item, Review, Setting, UsageDay, Utterance } from './types';

export class WortwechselDB extends Dexie {
  utterances!: EntityTable<Utterance, 'id'>;
  items!: EntityTable<Item, 'id'>;
  reviews!: EntityTable<Review, 'id'>;
  usage!: EntityTable<UsageDay, 'day'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'wortwechsel') {
    super(name);
    this.version(1).stores({
      utterances: 'id, createdAt, context',
      items: 'id, utteranceId, due, stage, lemma',
      reviews: 'id, reviewedAt, utteranceId',
      usage: 'day',
      settings: 'key',
    });
  }
}

export const db = new WortwechselDB();
