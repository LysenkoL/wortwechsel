import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeText } from './mergeText';
import { getSpeechRecognitionCtor, type SpeechRecognitionLike, type SpeechResultsLike } from './speechTypes';

export type SpeechState = 'idle' | 'listening' | 'stopped' | 'error';
export type SpeechError = 'denied' | 'no-speech' | 'network' | 'unknown';

interface Options {
  lang?: string;
  maxSeconds?: number;
}

const join = mergeText;

/** Split one recognition session into confirmed and still-changing text. */
function splitResults(results: SpeechResultsLike): { final: string; interim: string } {
  let final = '';
  let interim = '';
  for (let i = 0; i < results.length; i++) {
    const text = results[i][0]?.transcript ?? '';
    if (results[i].isFinal) final = join(final, text);
    else interim = join(interim, text);
  }
  return { final, interim };
}

export function useSpeechRecognition({ lang = 'de-DE', maxSeconds = 60 }: Options = {}) {
  const Ctor = getSpeechRecognitionCtor();
  const supported = Ctor !== null;

  const [rawState, setState] = useState<SpeechState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<SpeechError | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRunning = useRef(false);
  const committed = useRef(''); // text of earlier sessions (after automatic restarts)
  const sessionFinal = useRef('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const restartRef = useRef<(() => void) | null>(null);

  const fail = useCallback((e: SpeechError) => {
    wantRunning.current = false;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setError(e);
  }, []);

  const startSession = useCallback(() => {
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    sessionFinal.current = '';

    rec.onresult = (e) => {
      const { final, interim } = splitResults(e.results);
      sessionFinal.current = final;
      setFinalText(join(committed.current, final));
      setInterimText(interim);
    };

    rec.onerror = (e) => {
      switch (e.error) {
        case 'aborted':
          return;
        case 'no-speech':
          // Chrome fires this on silence; only an error if nothing was heard at all.
          if (!join(committed.current, sessionFinal.current)) fail('no-speech');
          return;
        case 'not-allowed':
        case 'service-not-allowed':
          fail('denied');
          return;
        case 'network':
          fail('network');
          return;
        default:
          fail('unknown');
      }
    };

    rec.onend = () => {
      committed.current = join(committed.current, sessionFinal.current);
      sessionFinal.current = '';
      setInterimText('');
      if (wantRunning.current) {
        // Chrome on Android ends the session on pauses: continue seamlessly.
        try {
          restartRef.current?.();
          return;
        } catch {
          fail('unknown');
        }
      }
      clearTimer();
      setFinalText(committed.current);
      setState((s) => (s === 'listening' ? 'stopped' : s));
    };

    recRef.current = rec;
    rec.start();
  }, [Ctor, lang, fail]);

  const stop = useCallback(() => {
    wantRunning.current = false;
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!Ctor || wantRunning.current) return;
    committed.current = '';
    sessionFinal.current = '';
    setFinalText('');
    setInterimText('');
    setError(null);
    setSeconds(0);
    wantRunning.current = true;
    setState('listening');
    clearTimer();
    timer.current = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        if (next >= maxSeconds) stop();
        return next;
      });
    }, 1000);
    try {
      startSession();
    } catch {
      fail('unknown');
    }
  }, [Ctor, maxSeconds, startSession, stop, fail]);

  const reset = useCallback(() => {
    wantRunning.current = false;
    recRef.current?.abort();
    clearTimer();
    committed.current = '';
    sessionFinal.current = '';
    setState('idle');
    setSeconds(0);
    setFinalText('');
    setInterimText('');
    setError(null);
  }, []);

  useEffect(
    () => () => {
      wantRunning.current = false;
      const rec = recRef.current;
      if (rec) {
        rec.onend = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.abort();
      }
      clearTimer();
    },
    [],
  );

  useEffect(() => {
    restartRef.current = startSession;
  }, [startSession]);

  // An error ends the attempt even if the browser never fires `end`.
  const state: SpeechState = error ? 'error' : rawState;

  return { supported, state, seconds, finalText, interimText, error, start, stop, reset };
}
