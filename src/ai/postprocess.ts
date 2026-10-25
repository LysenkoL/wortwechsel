import Ajv from 'ajv';
import {
  ANALYZE_SCHEMA_FULL, EVALUATE_SCHEMA_FULL,
  type AnalyzeResponse, type EvaluateResponse,
} from './contracts.generated';
import { AiError } from './errors';
import type { EvaluateRequest } from './types';

const ajv = new Ajv({ allErrors: true, strict: false });
const validateAnalyze = ajv.compile<AnalyzeResponse>(ANALYZE_SCHEMA_FULL);
const validateEvaluate = ajv.compile<EvaluateResponse>(EVALUATE_SCHEMA_FULL);

export function checkAnalyze(raw: unknown): AnalyzeResponse {
  if (!validateAnalyze(raw)) throw new AiError('BAD_RESPONSE', 'analyze: schema mismatch');
  return {
    ...raw,
    suggestions: raw.suggestions.slice(0, 3),
    keep: raw.keep.slice(0, 2),
    grammar_notes: raw.grammar_notes.slice(0, 2),
  };
}

/** Every requested id must come back exactly once; order is restored to the request's. */
export function checkEvaluate(raw: unknown, request: Pick<EvaluateRequest, 'targets'>): EvaluateResponse {
  if (!validateEvaluate(raw)) throw new AiError('BAD_RESPONSE', 'evaluate: schema mismatch');
  const byId = new Map<string, EvaluateResponse['targets'][number]>();
  for (const t of raw.targets) {
    if (byId.has(t.id)) throw new AiError('BAD_RESPONSE', 'evaluate: duplicate id');
    byId.set(t.id, t);
  }
  const wanted = request.targets.map((t) => t.id);
  if (byId.size !== wanted.length || wanted.some((id) => !byId.has(id))) {
    throw new AiError('BAD_RESPONSE', 'evaluate: ids do not match');
  }
  return {
    ...raw,
    targets: wanted.map((id) => byId.get(id)!),
    errors: raw.errors.slice(0, 3),
  };
}
