// German text-to-speech through the browser's built-in voices (free, offline-capable).
export interface TtsOptions { voiceURI?: string; rate?: number }

export function germanVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === 'undefined') return [];
  return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('de'));
}

// Dictionary abbreviations are read letter by letter ("jot-de-em") — say the full word.
const ABBREVIATIONS: [RegExp, string][] = [
  [/\bjdm\./gi, 'jemandem'],
  [/\bjdn\./gi, 'jemanden'],
  [/\bjds\./gi, 'jemandes'],
  [/\bjd\./gi, 'jemand'],
  [/\betw\./gi, 'etwas'],
  [/\bz\.\s?B\./g, 'zum Beispiel'],
  [/\busw\./g, 'und so weiter'],
];

/** Text as it should be spoken: abbreviations expanded, brackets, "…" and "/" smoothed out. */
export function speakable(text: string): string {
  let s = text;
  for (const [re, word] of ABBREVIATIONS) s = s.replace(re, word);
  return s
    .replace(/[()[\]]/g, ' ')
    .replace(/\s*\/\s*/g, ', ')
    .replace(/…|\.\.\./g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Prefer an on-device German voice: network voices on Android stutter on a weak connection. */
function pickVoice(voiceURI?: string): SpeechSynthesisVoice | undefined {
  const voices = germanVoices();
  return (
    voices.find((v) => v.voiceURI === voiceURI) ??
    voices.find((v) => v.lang === 'de-DE' && v.localService) ??
    voices.find((v) => v.localService) ??
    voices.find((v) => v.lang === 'de-DE') ??
    voices[0]
  );
}

let pending: ReturnType<typeof setTimeout> | null = null;

export function speakGerman(text: string, { voiceURI, rate = 0.95 }: TtsOptions = {}): void {
  if (typeof speechSynthesis === 'undefined') return;
  const spoken = speakable(text);
  if (!spoken) return;
  if (pending) clearTimeout(pending);
  // Chrome on Android garbles an utterance started right after cancel(): give it a moment.
  const busy = speechSynthesis.speaking || speechSynthesis.pending;
  if (busy) speechSynthesis.cancel();
  pending = setTimeout(() => {
    pending = null;
    const u = new SpeechSynthesisUtterance(spoken);
    u.lang = 'de-DE';
    u.rate = rate;
    const voice = pickVoice(voiceURI);
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }, busy ? 150 : 0);
}
