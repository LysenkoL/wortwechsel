import { db } from '../db/db';
import { getSetting, getUsage, setSetting } from '../db/repo';
import { localDay } from '../srs/scheduler';
import { ANALYZE_PROMPT, EVALUATE_PROMPT, type AnalyzeResponse, type EvaluateResponse } from './contracts.generated';
import { analyze, evaluate } from './client';
import { AiError } from './errors';
import type { EvaluateRequest } from './types';

// Real examples straight from the prompts: they double as fixtures.
const examples = (prompt: string) => {
  const blocks = [...prompt.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]));
  return blocks.reduce<{ input: any; output: any }[]>((acc, b, i) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (i % 2 === 0) acc.push({ input: b, output: null }); else acc[acc.length - 1].output = b;
    return acc;
  }, []);
};
const A = examples(ANALYZE_PROMPT);
const E = examples(EVALUATE_PROMPT);

const geminiBody = (obj: unknown, finishReason = 'STOP') =>
  ({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(obj) }] } }] });
const respond = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  await Promise.all([db.settings.clear(), db.usage.clear()]);
  await setSetting('apiKey', 'SECRET-KEY');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const bodyOf = (call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body as string);

describe('analyze', () => {
  const req = { transcript: A[0].input.transcript as string, context: 'work' as const };

  it('sends the prompt, a title-free schema and the key only in a header', async () => {
    fetchMock.mockReturnValueOnce(respond(geminiBody(A[0].output)));
    const result = await analyze(req);
    expect(result.suggestions).toHaveLength(2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('generativelanguage.googleapis.com');
    expect(String(url)).not.toContain('SECRET-KEY');
    expect(init.headers['x-goog-api-key']).toBe('SECRET-KEY');
    const body = bodyOf();
    expect(body.systemInstruction.parts[0].text).toBe(ANALYZE_PROMPT);
    expect(JSON.parse(body.contents[0].parts[0].text)).toEqual(req);
    expect(JSON.stringify(body.generationConfig.responseJsonSchema)).not.toContain('"title"');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(JSON.stringify(body)).not.toContain('SECRET-KEY');
  });

  it('uses the model from settings, else the default', async () => {
    fetchMock.mockImplementation(() => respond(geminiBody(A[0].output)));
    await analyze(req);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/models/gemini-3.5-flash-lite:');
    await setSetting('analyzeModel', 'my-model');
    await analyze(req);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/models/my-model:');
  });

  it('counts usage only on success', async () => {
    fetchMock.mockReturnValueOnce(respond({}, 429)).mockReturnValueOnce(respond(geminiBody(A[0].output)));
    await expect(analyze(req)).rejects.toMatchObject({ code: 'QUOTA' });
    expect(await getUsage('2000-01-01', '2100-01-01')).toEqual([]);
    await analyze(req);
    expect(await getUsage(localDay(new Date()), localDay(new Date()))).toMatchObject([{ analyze: 1, evaluate: 0 }]);
  });

  it('trims suggestions to 3, keep to 2 and grammar notes to 2', async () => {
    const big: AnalyzeResponse = {
      ...A[2].output,
      suggestions: [...A[2].output.suggestions, ...A[0].output.suggestions],
      keep: [...A[1].output.keep, ...A[1].output.keep, ...A[1].output.keep],
      grammar_notes: [...A[2].output.grammar_notes, ...A[2].output.grammar_notes, ...A[2].output.grammar_notes],
    };
    fetchMock.mockReturnValueOnce(respond(geminiBody(big)));
    const r = await analyze(req);
    expect([r.suggestions.length, r.keep.length, r.grammar_notes.length]).toEqual([3, 2, 2]);
  });

  it('fails with NO_KEY without touching the network', async () => {
    await setSetting('apiKey', '  ');
    await expect(analyze(req)).rejects.toMatchObject({ code: 'NO_KEY' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ transcript: '', context: 'work' }],
    [{ transcript: '   ', context: 'work' }],
    [{ transcript: 'x'.repeat(601), context: 'work' }],
    [{ transcript: 'Hallo', context: 'xxx' }],
  ])('rejects bad input %j without a request', async (bad) => {
    await expect(analyze(bad as never)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'BAD_KEY'], [403, 'BAD_KEY'], [429, 'QUOTA'], [404, 'BAD_REQUEST'], [500, 'NETWORK'], [503, 'NETWORK'],
  ])('maps HTTP %i to %s', async (status, code) => {
    fetchMock.mockImplementation(() => respond({ error: { message: 'x' } }, status));
    await expect(analyze(req)).rejects.toMatchObject({ code });
  });

  it('retries a busy server (5xx), then falls back to the other model', async () => {
    fetchMock.mockImplementation(() => respond({ error: { message: 'busy' } }, 503));
    await expect(analyze(req)).rejects.toMatchObject({ code: 'NETWORK', detail: 'HTTP 503' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toBe(urls[1]);
    expect(urls[2]).not.toBe(urls[0]);
  });

  it('recovers when the server answers after a 503', async () => {
    fetchMock.mockReturnValueOnce(respond({ error: { message: 'busy' } }, 503));
    fetchMock.mockImplementation(() => respond(geminiBody(A[0].output)));
    await expect(analyze(req)).resolves.toBeTruthy();
  });

  it('maps a 400 about the API key to BAD_KEY, other 400s to BAD_REQUEST', async () => {
    fetchMock.mockReturnValueOnce(respond({ error: { message: 'API key not valid. Please pass a valid API key.' } }, 400));
    await expect(analyze(req)).rejects.toMatchObject({ code: 'BAD_KEY' });
    fetchMock.mockReturnValueOnce(respond({ error: { message: 'Invalid JSON payload' } }, 400));
    await expect(analyze(req)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('maps safety blocks to BLOCKED', async () => {
    fetchMock.mockReturnValueOnce(respond({ promptFeedback: { blockReason: 'SAFETY' } }));
    await expect(analyze(req)).rejects.toMatchObject({ code: 'BLOCKED' });
    fetchMock.mockReturnValueOnce(respond(geminiBody({}, 'SAFETY')));
    await expect(analyze(req)).rejects.toMatchObject({ code: 'BLOCKED' });
  });

  it('maps network failures and offline mode to NETWORK', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(analyze(req)).rejects.toMatchObject({ code: 'NETWORK' });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await expect(analyze(req)).rejects.toMatchObject({ code: 'NETWORK' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('times out after 30 seconds', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce((_u: string, init: RequestInit) =>
      new Promise((_res, rej) => init.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))));
    const p = analyze(req).catch((e) => e);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await p).toMatchObject({ code: 'TIMEOUT' });
    vi.useRealTimers();
  });

  it('retries once on an unusable answer, then succeeds', async () => {
    fetchMock.mockReturnValueOnce(respond(geminiBody({ nonsense: true }))).mockReturnValueOnce(respond(geminiBody(A[0].output)));
    await expect(analyze(req)).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up with BAD_RESPONSE after exactly two attempts', async () => {
    fetchMock.mockImplementation(() => respond(geminiBody({ nonsense: true })));
    await expect(analyze(req)).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats non-JSON text and truncated answers as BAD_RESPONSE', async () => {
    fetchMock.mockImplementation(() => respond({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not json' }] } }] }));
    await expect(analyze(req)).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => respond(geminiBody({}, 'MAX_TOKENS')));
    await expect(analyze(req)).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('ignores "thought" parts of the answer', async () => {
    fetchMock.mockReturnValueOnce(respond({
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'thinking…', thought: true }, { text: JSON.stringify(A[1].output) }] } }],
    }));
    await expect(analyze({ transcript: A[1].input.transcript, context: 'daily' })).resolves.toMatchObject({ is_german: true });
  });

  it('never leaks the key into errors', async () => {
    fetchMock.mockReturnValueOnce(respond({ error: { message: 'bad' } }, 403));
    const err = (await analyze(req).catch((e) => e)) as AiError;
    expect(String(err.message) + String(err.detail)).not.toContain('SECRET-KEY');
  });
});

describe('evaluate', () => {
  const baseReq: EvaluateRequest = E[1].input;

  it('returns the checked result, uses the Lite default model and counts usage', async () => {
    fetchMock.mockReturnValueOnce(respond(geminiBody(E[1].output)));
    const r: EvaluateResponse = await evaluate(baseReq);
    expect(r.targets.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/models/gemini-3.1-flash-lite:');
    expect(bodyOf().systemInstruction.parts[0].text).toBe(EVALUATE_PROMPT);
    expect(await getSetting('evaluateModel', '')).toBe('');
    expect(await getUsage(localDay(new Date()), localDay(new Date()))).toMatchObject([{ analyze: 0, evaluate: 1 }]);
  });

  it('restores the order of targets to match the request', async () => {
    const swapped = { ...E[1].output, targets: [...E[1].output.targets].reverse() };
    fetchMock.mockReturnValueOnce(respond(geminiBody(swapped)));
    expect((await evaluate(baseReq)).targets.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('rejects a missing, extra or duplicated id as BAD_RESPONSE (after one retry)', async () => {
    for (const targets of [
      [E[1].output.targets[0]],
      [...E[1].output.targets, { id: 't3', used: true, correct: true, comment_ru: '' }],
      [E[1].output.targets[0], E[1].output.targets[0]],
    ]) {
      fetchMock.mockReset();
      fetchMock.mockImplementation(() => respond(geminiBody({ ...E[1].output, targets })));
      await expect(evaluate(baseReq)).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }
  });

  it('validates the request locally', async () => {
    const bad: EvaluateRequest[] = [
      { ...baseReq, answer: '' },
      { ...baseReq, targets: [] },
      { ...baseReq, targets: Array.from({ length: 6 }, (_, i) => ({ ...baseReq.targets[0], id: `x${i}` })) },
      { ...baseReq, sentence: '' }, // rephrase needs the original sentence
    ];
    for (const b of bad) await expect(evaluate(b)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows an empty sentence for transfer tasks', async () => {
    fetchMock.mockReturnValueOnce(respond(geminiBody(E[1].output)));
    await expect(evaluate({ ...baseReq, kind: 'transfer', sentence: '', topic: 'Arbeit' })).resolves.toBeDefined();
  });
});
