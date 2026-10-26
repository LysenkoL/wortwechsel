import { speakable } from './tts';

describe('speakable', () => {
  it('expands dictionary abbreviations and drops brackets', () => {
    expect(speakable('sich (mit jdm.) abstimmen')).toBe('sich mit jemandem abstimmen');
    expect(speakable('jdm. etw. vorschlagen')).toBe('jemandem etwas vorschlagen');
    expect(speakable('jdm. klarmachen, dass …')).toBe('jemandem klarmachen, dass');
    expect(speakable('Bescheid geben / sagen')).toBe('Bescheid geben, sagen');
  });

  it('leaves normal sentences alone', () => {
    expect(speakable('Gib mir bitte Bescheid, wenn du fertig bist.')).toBe('Gib mir bitte Bescheid, wenn du fertig bist.');
  });
});
