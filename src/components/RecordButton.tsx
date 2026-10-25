import { ruSpeech } from '../i18n/ru';
import type { SpeechError, SpeechState } from '../features/speech/useSpeechRecognition';

interface Props {
  supported: boolean;
  state: SpeechState;
  seconds: number;
  maxSeconds?: number;
  finalText?: string;
  interimText?: string;
  error: SpeechError | null;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
}

const errorText: Record<SpeechError, string> = {
  denied: ruSpeech.denied,
  'no-speech': ruSpeech.noSpeech,
  network: ruSpeech.network,
  unknown: ruSpeech.unknown,
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function RecordButton({
  supported, state, seconds, maxSeconds = 60, finalText = '', interimText = '', error, disabled, onStart, onStop,
}: Props) {
  if (!supported) return <p className="muted small">{ruSpeech.unsupported}</p>;

  const listening = state === 'listening';
  return (
    <div className={`record${listening ? ' live' : ''}`}>
      <button
        type="button"
        className={`record-btn${listening ? ' on' : ''}`}
        aria-pressed={listening}
        disabled={disabled}
        onClick={listening ? onStop : onStart}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          {listening
            ? <rect x="6" y="6" width="12" height="12" rx="3" />
            : <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z" />}
        </svg>
        <span className="sr-only">{listening ? ruSpeech.stop : ruSpeech.tapToSpeak}</span>
      </button>
      {!listening && <div className="record-hint" aria-hidden="true">{ruSpeech.tapToSpeak}</div>}
      {listening && (
        <div className="muted small" role="status">
          {ruSpeech.listening} {clock(seconds)} / {clock(maxSeconds)}
        </div>
      )}
      {(finalText || interimText) && (
        <p className="live-text">
          {finalText} <span className="muted">{interimText}</span>
        </p>
      )}
      {error && <p className="error small" role="alert">{errorText[error]}</p>}
    </div>
  );
}
