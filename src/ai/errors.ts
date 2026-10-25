export type AiErrorCode =
  | 'NO_KEY' | 'BAD_KEY' | 'QUOTA' | 'NETWORK' | 'TIMEOUT' | 'BLOCKED' | 'BAD_RESPONSE' | 'BAD_REQUEST';

export class AiError extends Error {
  readonly code: AiErrorCode;
  /** Short technical hint for the UI (never contains the API key). */
  readonly detail?: string;
  constructor(code: AiErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'AiError';
    this.code = code;
    this.detail = detail;
  }
}
