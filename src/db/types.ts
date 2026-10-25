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
}

export interface Setting {
  key: string;
  value: unknown;
}

export interface DueGroup {
  utterance: Utterance;
  items: Item[];
}

export interface ExportFile {
  app: 'wortwechsel';
  version: 1;
  exportedAt: number;
  utterances: Utterance[];
  items: Item[];
  reviews: Review[];
}
