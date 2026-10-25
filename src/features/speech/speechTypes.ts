// Minimal typings for the Web Speech API (not part of lib.dom in every TS version).
export interface SpeechAlternativeLike { transcript: string }
export interface SpeechResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechAlternativeLike;
}
export interface SpeechResultsLike {
  readonly length: number;
  [index: number]: SpeechResultLike;
}
export interface SpeechResultEventLike { results: SpeechResultsLike }
export interface SpeechErrorEventLike { error: string }

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechResultEventLike) => void) | null;
  onerror: ((e: SpeechErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
