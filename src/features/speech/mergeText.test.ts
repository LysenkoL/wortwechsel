import { describe, expect, it } from 'vitest';
import { mergeText } from './mergeText';

describe('mergeText', () => {
  it('appends new words', () => expect(mergeText('Ich habe', 'mit dem Chef gesprochen')).toBe('Ich habe mit dem Chef gesprochen'));
  it('replaces a growing prefix (Android repeats)', () => {
    let t = '';
    for (const s of ['Ich', 'Ich habe', 'Ich habe das', 'Ich habe das gemacht']) t = mergeText(t, s);
    expect(t).toBe('Ich habe das gemacht');
  });
  it('skips a repeated tail', () => expect(mergeText('Ich habe das gemacht', 'das gemacht')).toBe('Ich habe das gemacht'));
  it('merges overlapping seams', () => expect(mergeText('Ich habe mit dem', 'mit dem Chef')).toBe('Ich habe mit dem Chef'));
  it('ignores case and empty input', () => {
    expect(mergeText('ich habe', 'Ich habe das')).toBe('Ich habe das');
    expect(mergeText('Hallo', '  ')).toBe('Hallo');
    expect(mergeText('', 'Hallo Welt')).toBe('Hallo Welt');
  });
});
