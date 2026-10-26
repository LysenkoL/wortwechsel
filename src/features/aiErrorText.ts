import { AiError } from '../ai/errors';
import { ruAiError } from '../i18n/ru';

export interface DescribedError {
  text: string;
  detail?: string;
  toSettings: boolean;
  retryable: boolean;
}

/** Turns any thrown value into a user-facing message (UI never shows raw errors). */
export function describeAiError(e: unknown): DescribedError {
  const code = e instanceof AiError ? e.code : 'BAD_RESPONSE';
  switch (code) {
    case 'NO_KEY': return { text: ruAiError.noKey, toSettings: true, retryable: false };
    case 'BAD_KEY': return { text: ruAiError.badKey, toSettings: true, retryable: false };
    case 'QUOTA': return { text: ruAiError.quota, toSettings: false, retryable: false };
    case 'BLOCKED': return { text: ruAiError.blocked, toSettings: false, retryable: false };
    case 'BAD_REQUEST':
      return { text: ruAiError.badRequest, detail: e instanceof AiError ? e.detail : undefined, toSettings: true, retryable: false };
    case 'TIMEOUT': return { text: ruAiError.timeout, toSettings: false, retryable: true };
    default: {
      if (e instanceof AiError && code === 'NETWORK' && /^HTTP 5\d\d$/.test(e.detail ?? '')) {
        return { text: ruAiError.busy, detail: e.detail, toSettings: false, retryable: true };
      }
      // Short technical hint (error code + Google's message) so problems can be diagnosed from a screenshot.
      const detail = e instanceof AiError ? [e.code, e.detail].filter(Boolean).join(': ') : 'unknown';
      return { text: ruAiError.generic, detail, toSettings: false, retryable: true };
    }
  }
}
