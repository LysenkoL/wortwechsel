import type { Context } from '../db/types';

export interface AnalyzeRequest {
  transcript: string;
  context: Context;
}

export interface EvaluateTarget {
  id: string;
  original: string;
  replacement: string;
  lemma: string;
  pattern: string;
}

export interface EvaluateRequest {
  kind: 'rephrase' | 'transfer';
  sentence: string; // may be '' for transfer
  targets: EvaluateTarget[];
  answer: string;
  topic: string | null; // transfer only
}

export interface CardsRequest {
  mode: 'topic' | 'complete';
  topic: string; // deck title (+ description)
  context: Context;
  count: number; // topic mode: how many cards; complete mode: words.length
  words: string[]; // complete mode only
  exclude: string[]; // terms already in the deck
}
