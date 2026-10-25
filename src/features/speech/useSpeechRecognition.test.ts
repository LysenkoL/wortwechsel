import { act, renderHook } from '@testing-library/react';
import { useSpeechRecognition } from './useSpeechRecognition';
import type { SpeechResultsLike } from './speechTypes';

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = ''; continuous = false; interimResults = false; maxAlternatives = 1;
  onresult: ((e: { results: SpeechResultsLike }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false; aborted = false;
  constructor() { FakeRecognition.instances.push(this); }
  start() { this.started = true; }
  stop() { queueMicrotask(() => this.onend?.()); }
  abort() { this.aborted = true; }
  emit(parts: { t: string; final: boolean }[]) {
    const results = parts.map((p) => Object.assign([{ transcript: p.t }], { isFinal: p.final }));
    this.onresult?.({ results: results as unknown as SpeechResultsLike });
  }
  end() { this.onend?.(); }
  fail(error: string) { this.onerror?.({ error }); }
}
const last = () => FakeRecognition.instances[FakeRecognition.instances.length - 1];

beforeEach(() => {
  FakeRecognition.instances = [];
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
});

describe('useSpeechRecognition', () => {
  it('reports unsupported browsers', () => {
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.supported).toBe(false);
  });

  it('configures German continuous recognition with interim results', () => {
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start());
    expect(last()).toMatchObject({ lang: 'de-DE', continuous: true, interimResults: true, started: true });
    expect(result.current.state).toBe('listening');
  });

  it('builds final and interim text from results without duplicates', () => {
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start());
    act(() => last().emit([{ t: 'Ich habe', final: false }]));
    expect(result.current.interimText).toBe('Ich habe');
    act(() => last().emit([{ t: 'Ich habe gearbeitet', final: true }, { t: 'und dann', final: false }]));
    expect(result.current.finalText).toBe('Ich habe gearbeitet');
    expect(result.current.interimText).toBe('und dann');
    // the browser repeats the whole list: still no duplication
    act(() => last().emit([{ t: 'Ich habe gearbeitet', final: true }, { t: 'und dann', final: true }]));
    expect(result.current.finalText).toBe('Ich habe gearbeitet und dann');
  });

  it('restarts after the browser ends the session on its own and keeps the text', () => {
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start());
    act(() => last().emit([{ t: 'Erster Satz', final: true }]));
    act(() => last().end());
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(result.current.state).toBe('listening');
    act(() => last().emit([{ t: 'Zweiter Satz', final: true }]));
    expect(result.current.finalText).toBe('Erster Satz Zweiter Satz');
  });

  it('stop() ends without restarting', async () => {
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start());
    act(() => last().emit([{ t: 'Hallo', final: true }]));
    await act(async () => { result.current.stop(); await Promise.resolve(); });
    expect(result.current.state).toBe('stopped');
    expect(result.current.finalText).toBe('Hallo');
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it('stops automatically after maxSeconds', async () => {
    const { result } = renderHook(() => useSpeechRecognition({ maxSeconds: 3 }));
    act(() => result.current.start());
    await act(async () => { vi.advanceTimersByTime(3000); await Promise.resolve(); });
    expect(result.current.state).toBe('stopped');
    expect(result.current.seconds).toBe(3);
  });

  it('maps permission errors to "denied"', () => {
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start());
    act(() => last().fail('not-allowed'));
    expect(result.current.error).toBe('denied');
    expect(result.current.state).toBe('error');
  });

  it('"no-speech" is an error only when nothing was heard', () => {
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start());
    act(() => last().fail('no-speech'));
    expect(result.current.error).toBe('no-speech');

    act(() => result.current.reset());
    act(() => result.current.start());
    act(() => last().emit([{ t: 'Hallo', final: true }]));
    act(() => last().fail('no-speech'));
    expect(result.current.error).toBeNull();
  });

  it('maps network errors and ignores "aborted"', () => {
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start());
    act(() => last().fail('aborted'));
    expect(result.current.error).toBeNull();
    act(() => last().fail('network'));
    expect(result.current.error).toBe('network');
  });

  it('aborts the recognizer on unmount', () => {
    const { result, unmount } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start());
    unmount();
    expect(last().aborted).toBe(true);
  });
});
