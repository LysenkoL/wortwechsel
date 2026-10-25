import type { EvaluateResponse } from '../ai/contracts.generated';
import type { Rating } from '../db/types';

export interface RatingContext {
  hintUsed: boolean;
  meaningPreserved: boolean;
  naturalness: EvaluateResponse['naturalness'];
  easyTapped: boolean;
}

/** Deterministic mapping from model facts to an FSRS rating (decision D-006). */
export function rateTarget(
  target: Pick<EvaluateResponse['targets'][number], 'used' | 'correct'>,
  ctx: RatingContext,
): Rating {
  if (!target.used) return 1;
  if (!target.correct) return 2;
  if (ctx.hintUsed || !ctx.meaningPreserved || ctx.naturalness === 'unnatural') return 2;
  return ctx.easyTapped ? 4 : 3;
}
