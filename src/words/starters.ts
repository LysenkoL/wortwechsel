import starterData from '../../data/starter-decks.json';
import type { Context } from '../db/types';

export interface StarterDeck {
  id: string;
  emoji: string;
  title: string;
  context: Context;
  description: string;
  cards: { term: string; definition: string; example: string; note: string; emoji: string }[];
}

export const STARTER_DECKS = starterData as StarterDeck[];
