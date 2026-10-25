import { highlight } from './highlight';

describe('highlight', () => {
  it('marks an exact match', () => {
    const r = highlight('Er hat gesagt, dass es geht.', ['gesagt']);
    expect(r.segments).toEqual([
      { text: 'Er hat ', mark: false },
      { text: 'gesagt', mark: true },
      { text: ', dass es geht.', mark: false },
    ]);
    expect(r.missing).toEqual([]);
  });

  it('ignores case and keeps the original casing', () => {
    const r = highlight('Gesagt ist gesagt.', ['gesagt']);
    expect(r.segments[0]).toEqual({ text: 'Gesagt', mark: true });
  });

  it('marks several needles in text order', () => {
    const r = highlight('Er hat gesagt, dass wir das anders machen müssen.', ['das anders machen', 'gesagt']);
    expect(r.segments.filter((s) => s.mark).map((s) => s.text)).toEqual(['gesagt', 'das anders machen']);
  });

  it('reports needles that are not found and leaves the text unmarked', () => {
    const r = highlight('Ich gehe nach Hause.', ['gesagt']);
    expect(r.segments).toEqual([{ text: 'Ich gehe nach Hause.', mark: false }]);
    expect(r.missing).toEqual(['gesagt']);
  });

  it('skips overlapping needles and empty ones', () => {
    const r = highlight('das anders machen', ['das anders', 'anders machen', '  ']);
    expect(r.segments.filter((s) => s.mark).map((s) => s.text)).toEqual(['das anders']);
    expect(r.missing).toEqual(['  ']);
  });
});
