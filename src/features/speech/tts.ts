// German text-to-speech through the browser's built-in voices (free, offline-capable).
export interface TtsOptions { voiceURI?: string; rate?: number }

export function germanVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === 'undefined') return [];
  return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('de'));
}

export function speakGerman(text: string, { voiceURI, rate = 0.95 }: TtsOptions = {}): void {
  if (typeof speechSynthesis === 'undefined' || !text.trim()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  u.rate = rate;
  const voices = germanVoices();
  const voice = voices.find((v) => v.voiceURI === voiceURI) ?? voices[0];
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}
