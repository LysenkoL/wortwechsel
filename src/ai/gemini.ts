// The ONLY file that knows the Gemini wire format. Swap this file to change provider.
import { AiError } from './errors';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface StructuredRequest {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userText: string;
  schema: object;
  signal: AbortSignal;
}

interface GeminiResponse {
  promptFeedback?: { blockReason?: string };
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; thought?: boolean }[] };
  }[];
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } };
    return (j.error?.message ?? '').slice(0, 200);
  } catch {
    return '';
  }
}

export async function generateStructured(req: StructuredRequest): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/models/${encodeURIComponent(req.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': req.apiKey },
      signal: req.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: req.userText }] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: req.schema },
      }),
    });
  } catch {
    throw new AiError(req.signal.aborted ? 'TIMEOUT' : 'NETWORK');
  }

  if (!res.ok) {
    const message = await readErrorMessage(res);
    if (res.status === 401 || res.status === 403) throw new AiError('BAD_KEY', message);
    if (res.status === 429) throw new AiError('QUOTA', message);
    if (res.status === 400 && /api key/i.test(message)) throw new AiError('BAD_KEY', message);
    if (res.status === 400 || res.status === 404) throw new AiError('BAD_REQUEST', message);
    throw new AiError('NETWORK', `HTTP ${res.status}`);
  }

  let data: GeminiResponse;
  try {
    data = (await res.json()) as GeminiResponse;
  } catch {
    throw new AiError('BAD_RESPONSE', 'not JSON');
  }

  if (data.promptFeedback?.blockReason) throw new AiError('BLOCKED', data.promptFeedback.blockReason);
  const candidate = data.candidates?.[0];
  if (!candidate) throw new AiError('BAD_RESPONSE', 'no candidates');
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    throw new AiError(candidate.finishReason === 'MAX_TOKENS' ? 'BAD_RESPONSE' : 'BLOCKED', candidate.finishReason);
  }

  const text = (candidate.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('');
  try {
    return JSON.parse(text);
  } catch {
    throw new AiError('BAD_RESPONSE', 'answer is not JSON');
  }
}
