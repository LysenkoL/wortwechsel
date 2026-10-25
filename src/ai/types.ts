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
