// Screens call only analyze() and evaluate(). All network access lives in src/ai/.
import {
  ANALYZE_PROMPT, ANALYZE_SCHEMA, EVALUATE_PROMPT, EVALUATE_SCHEMA,
  type AnalyzeResponse, type EvaluateResponse,
} from './contracts.generated';
import { DEFAULT_ANALYZE_MODEL, DEFAULT_EVALUATE_MODEL, REQUEST_TIMEOUT_MS } from './defaults';
import { AiError } from './errors';
import { generateStructured } from './gemini';
import { checkAnalyze, checkEvaluate } from './postprocess';
import type { AnalyzeRequest, EvaluateRequest } from './types';
import { getSetting, incrementUsage } from '../db/repo';

const MAX_TEXT = 600;

/** Pause between attempts when Google answers 5xx ("overloaded"); tests set it to 0. */
export const retryPolicy = { delayMs: 1500 };
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const isServerBusy = (e: unknown) =>
  e instanceof AiError && e.code === 'NETWORK' && /^HTTP 5\d\d$/.test(e.detail ?? '');
const CONTEXTS = ['work', 'daily', 'office', 'free'];

const textOk = (s: unknown, allowEmpty = false): s is string =>
  typeof s === 'string' && (allowEmpty || s.trim().length > 0) && s.length <= MAX_TEXT;

function validateAnalyzeRequest(r: AnalyzeRequest): void {
  if (!textOk(r.transcript) || !CONTEXTS.includes(r.context)) throw new AiError('BAD_REQUEST', 'analyze input');
}

function validateEvaluateRequest(r: EvaluateRequest): void {
  const ok =
    (r.kind === 'rephrase' || r.kind === 'transfer') &&
    textOk(r.answer) &&
    textOk(r.sentence, r.kind === 'transfer') &&
    (r.kind === 'rephrase' || r.topic === null || textOk(r.topic)) &&
    Array.isArray(r.targets) && r.targets.length >= 1 && r.targets.length <= 5;
  if (!ok) throw new AiError('BAD_REQUEST', 'evaluate input');
}

async function call(
  kind: 'analyze' | 'evaluate',
  systemPrompt: string,
  schema: object,
  userText: string,
  defaultModel: string,
): Promise<unknown> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AiError('NETWORK', 'offline');
  const apiKey = (await getSetting<string>('apiKey', '')).trim();
  if (!apiKey) throw new AiError('NO_KEY');
  const chosen = (await getSetting<string>(`${kind}Model`, '')).trim() || defaultModel;
  // Busy server: retry the same model, then try the other default model once.
  const alternative = chosen === DEFAULT_EVALUATE_MODEL ? DEFAULT_ANALYZE_MODEL : DEFAULT_EVALUATE_MODEL;
  const models = [chosen, chosen, alternative];

  let last: unknown;
  for (let i = 0; i < models.length; i++) {
    if (i > 0) await sleep(retryPolicy.delayMs * i);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await generateStructured({ apiKey, model: models[i], systemPrompt, userText, schema, signal: controller.signal });
    } catch (e) {
      last = e;
      if (!isServerBusy(e)) throw e;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw last;
}

/** Run `attempt` once more if the model's answer was unusable. */
async function withOneRetry<T>(attempt: () => Promise<T>): Promise<T> {
  try {
    return await attempt();
  } catch (e) {
    if (e instanceof AiError && e.code === 'BAD_RESPONSE') return attempt();
    throw e;
  }
}

export async function analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  validateAnalyzeRequest(req);
  const userText = JSON.stringify({ transcript: req.transcript, context: req.context });
  const result = await withOneRetry(async () =>
    checkAnalyze(await call('analyze', ANALYZE_PROMPT, ANALYZE_SCHEMA, userText, DEFAULT_ANALYZE_MODEL)),
  );
  await incrementUsage('analyze');
  return result;
}

export async function evaluate(req: EvaluateRequest): Promise<EvaluateResponse> {
  validateEvaluateRequest(req);
  const userText = JSON.stringify(req);
  const result = await withOneRetry(async () =>
    checkEvaluate(await call('evaluate', EVALUATE_PROMPT, EVALUATE_SCHEMA, userText, DEFAULT_EVALUATE_MODEL), req),
  );
  await incrementUsage('evaluate');
  return result;
}
