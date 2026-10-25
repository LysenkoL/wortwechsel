import { newCard, reviewCard, firstDueAfterSave, localDay, serializeCard, deserializeCard } from './scheduler';
import { rateTarget } from './rating';
import { createEmptyCard } from 'ts-fsrs';

const base = { hintUsed: false, meaningPreserved: true, naturalness: 'natural' as const, easyTapped: false };

describe('rateTarget', () => {
  it('Again when the target was not used', () => {
    expect(rateTarget({ used: false, correct: false }, base)).toBe(1);
  });
  it('Hard when used but incorrect', () => {
    expect(rateTarget({ used: true, correct: false }, base)).toBe(2);
  });
  it('Hard when a hint was used', () => {
    expect(rateTarget({ used: true, correct: true }, { ...base, hintUsed: true })).toBe(2);
  });
  it('Hard when meaning is not preserved', () => {
    expect(rateTarget({ used: true, correct: true }, { ...base, meaningPreserved: false })).toBe(2);
  });
  it('Hard when the sentence is unnatural', () => {
    expect(rateTarget({ used: true, correct: true }, { ...base, naturalness: 'unnatural' })).toBe(2);
  });
  it('Good for a clean answer, even if merely understandable', () => {
    expect(rateTarget({ used: true, correct: true }, base)).toBe(3);
    expect(rateTarget({ used: true, correct: true }, { ...base, naturalness: 'understandable' })).toBe(3);
  });
  it('Easy only when the user tapped it on a Good answer', () => {
    expect(rateTarget({ used: true, correct: true }, { ...base, easyTapped: true })).toBe(4);
    expect(rateTarget({ used: true, correct: true }, { ...base, easyTapped: true, hintUsed: true })).toBe(2);
  });
});

describe('firstDueAfterSave', () => {
  it('is tomorrow 04:00 local time from the morning', () => {
    const due = new Date(firstDueAfterSave(new Date(2026, 9, 25, 10, 0)));
    expect([due.getFullYear(), due.getMonth(), due.getDate(), due.getHours(), due.getMinutes()]).toEqual([2026, 9, 26, 4, 0]);
  });
  it('is tomorrow 04:00 from late evening', () => {
    const due = new Date(firstDueAfterSave(new Date(2026, 9, 25, 23, 59)));
    expect([due.getDate(), due.getHours()]).toEqual([26, 4]);
  });
  it('stays at 04:00 across a DST change (day has 25 hours)', () => {
    const due = new Date(firstDueAfterSave(new Date(2026, 9, 24, 12, 0))); // night of 25 Oct 2026 in Europe
    expect([due.getDate(), due.getHours()]).toEqual([25, 4]);
  });
  it('rolls over month and year', () => {
    const due = new Date(firstDueAfterSave(new Date(2026, 11, 31, 20, 0)));
    expect([due.getFullYear(), due.getMonth(), due.getDate()]).toEqual([2027, 0, 1]);
  });
});

describe('card scheduling', () => {
  it('serialises and deserialises without loss', () => {
    const card = createEmptyCard(new Date(2026, 9, 25));
    expect(serializeCard(deserializeCard(serializeCard(card)))).toEqual(serializeCard(card));
  });
  it('newCard is due tomorrow 04:00', () => {
    const now = new Date(2026, 9, 25, 15, 0);
    expect(newCard(now).due).toBe(firstDueAfterSave(now));
  });
  it('Good pushes the due date out, Again brings it back within about a day', () => {
    const now = new Date(2026, 9, 26, 5, 0);
    const good = reviewCard(newCard(new Date(2026, 9, 25)), now, 3);
    expect(good.due).toBeGreaterThan(now.getTime() + 12 * 3600 * 1000);
    const again = reviewCard(newCard(new Date(2026, 9, 25)), now, 1);
    expect(again.due - now.getTime()).toBeLessThanOrEqual(2 * 24 * 3600 * 1000);
    expect(good.due).toBeGreaterThan(again.due);
  });
  it('intervals never exceed the 180-day maximum', () => {
    let card = newCard(new Date(2026, 0, 1));
    let now = new Date(2026, 0, 2, 5);
    for (let i = 0; i < 30; i++) {
      card = reviewCard(card, now, 4);
      now = new Date(card.due);
    }
    expect(card.scheduled_days).toBeLessThanOrEqual(180 + 10); // fuzz allowance
  });
});

describe('localDay', () => {
  it('formats with zero padding', () => {
    expect(localDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
