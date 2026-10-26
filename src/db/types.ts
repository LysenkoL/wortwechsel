import type { AnalyzeResponse, EvaluateResponse, Suggestion } from '../ai/contracts.generated';

export type Context = 'work' | 'daily' | 'office' | 'free';
export type Register = Suggestion['register'];
export type Stage = 'learning' | 'active' | 'suspended';
export type Rating = 1 | 2 | 3 | 4;

/** ts-fsrs Card with every Date stored as epoch ms (IndexedDB-friendly). */
export interface SerializedCard {
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: number | null;
}

export interface Utterance {
  id: string;
  createdAt: number;
  context: Context;
  question: string | null;
  rawTranscript: string;
  transcript: string;
  analysis: AnalyzeResponse;
}

export interface Item {
  id: string;
  utteranceId: string;
  createdAt: number;
  original: string;
  replacement: string;
  lemma: string;
  pattern: string;
  meaningRu: string;
  noteRu: string;
  register: Register;
  exampleDe: string;
  card: SerializedCard;
  due: number;
  correctDays: string[];
  stage: Stage;
}

export interface Review {
  id: string;
  utteranceId: string;
  itemIds: string[];
  kind: 'rephrase' | 'transfer';
  reviewedAt: number;
  answerTranscript: string;
  hintUsed: boolean;
  evaluation: EvaluateResponse;
  ratings: Record<string, Rating>;
}

export interface UsageDay {
  day: string; // 'YYYY-MM-DD' local
  analyze: number;
  evaluate: number;
  generate?: number; // AI word cards (added with T14)
}

export interface Setting {
  key: string;
  value: unknown;
}

export interface DueGroup {
  utterance: Utterance;
  items: Item[];
}

// ---------- word sets (T14) ----------

export interface Deck {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  emoji: string;
  context: Context; // topic group on the "Слова" screen
  description: string;
  starterId: string | null; // id from data/starter-decks.json
  bestMatchMs: number | null; // record of the "Подбор" game
}

export interface CardStats {
  seen: number;
  correct: number;
  wrong: number;
  streak: number; // correct answers in a row (any mode)
  lastAt: number | null;
}

export interface WordCard {
  id: string;
  deckId: string;
  createdAt: number;
  term: string; // German: "der Antrag", "einen Termin vereinbaren"
  definition: string; // Russian
  example: string; // German sentence or ''
  note: string; // free note or ''
  emoji?: string; // 1–2 association emoji or '' (absent on cards from before this field)
  starred: boolean;
  sourceItemId: string | null; // Item it was copied from
  stats: CardStats;
  card: SerializedCard; // FSRS, used only by the "Повторение" mode
  due: number;
}

export type StudyMode = 'flashcards' | 'learn' | 'write' | 'listen' | 'speak' | 'test' | 'match' | 'review';

export interface WordLogEntry {
  id: string;
  cardId: string;
  deckId: string;
  at: number;
  mode: StudyMode;
  correct: boolean;
  rating: Rating | null; // review mode only
  wasNew: boolean; // review mode: first FSRS review of this card
}

export interface ExportFileV1 {
  app: 'wortwechsel';
  version: 1;
  exportedAt: number;
  utterances: Utterance[];
  items: Item[];
  reviews: Review[];
}

export interface ExportFile extends Omit<ExportFileV1, 'version'> {
  version: 2;
  decks: Deck[];
  cards: WordCard[];
  wordLog: WordLogEntry[];
}
