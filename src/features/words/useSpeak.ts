import { useCallback } from 'react';
import { getSetting } from '../../db/repo';
import { speakGerman } from '../speech/tts';

/** German TTS with the voice and rate from Settings. */
export function useSpeak(): (text: string) => void {
  return useCallback((text: string) => {
    void (async () => {
      speakGerman(text, {
        voiceURI: await getSetting<string>('ttsVoice', ''),
        rate: await getSetting<number>('ttsRate', 0.95),
      });
    })();
  }, []);
}
