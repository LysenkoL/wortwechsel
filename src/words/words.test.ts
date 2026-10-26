import { alternatives, gradeAnswer, levenshtein, normalize } from './grade';
import { parseImport } from './parseImport';
import { answer, continueLearn, current, isFinished, learnedCount, ROUND_SIZE, startLearn } from './learn';
import { buildQuestion, buildTest, choices, type StudyCard } from './questions';
import { buildMatch, isPair } from './match';
import { emptyStats, masteryCounts, masteryOf, nextStats } from './mastery';
import { seeded, shuffle } from './random';

const card = (id: string, term: string, definition: string): StudyCard => ({ id, term, definition, example: '', note: '' });
const deck = [
  card('a', 'der Antrag', 'заявление'),
  card('b', 'einen Termin vereinbaren', 'договориться о встрече'),
  card('c', 'die Frist', 'срок'),
  card('d', 'sich um etw. kümmern', 'заботиться, заниматься'),
  card('e', 'Bescheid geben', 'сообщить'),
];

describe('grade', () => {
  it('normalizes case, punctuation, umlauts and placeholders', () => {
    expect(normalize('  Sich um ETW. kümmern! ')).toBe('sich um kuemmern');
    expect(normalize('Straße')).toBe(normalize('strasse'));
    expect(normalize('ещё')).toBe('еще');
  });

  it('accepts exact answers, ae/ss spellings and missing placeholders', () => {
    expect(gradeAnswer('sich um etw. kümmern', 'sich um kuemmern', 'de').verdict).toBe('correct');
    expect(gradeAnswer('die Straße', 'die strasse', 'de').verdict).toBe('correct');
  });

  it('flags a wrong or missing article separately — it is not ok', () => {
    expect(gradeAnswer('die Frist', 'der Frist', 'de')).toEqual({ verdict: 'article', ok: false });
    expect(gradeAnswer('der Antrag', 'die antrag', 'de').verdict).toBe('article');
    expect(gradeAnswer('der Antrag', 'Antrag', 'de')).toEqual({ verdict: 'article', ok: false }); // forgotten
    expect(gradeAnswer('der Antrag', 'der Vertrag', 'de').verdict).toBe('wrong');
  });

  it('forgives one typo in longer words, but not in short ones', () => {
    expect(gradeAnswer('vereinbaren', 'vereinbarn', 'de')).toEqual({ verdict: 'typo', ok: true });
    expect(gradeAnswer('einen Termin vereinbaren', 'einen termin vereinbahren', 'de').verdict).toBe('typo');
    expect(gradeAnswer('Ort', 'Art', 'de').verdict).toBe('wrong');
  });

  it('accepts any Russian synonym, but not a fragment like "что"', () => {
    expect(gradeAnswer('заботиться, заниматься', 'заниматься', 'ru').ok).toBe(true);
    expect(gradeAnswer('ясно дать понять, что …', 'что', 'ru').ok).toBe(false);
    expect(gradeAnswer('ясно дать понять, что …', 'ясно дать понять', 'ru').ok).toBe(true);
  });

  it('handles brackets and noun plurals', () => {
    expect(alternatives('(sich) vorstellen', 'de')).toEqual(expect.arrayContaining(['sich vorstellen', 'vorstellen']));
    expect(gradeAnswer('der Antrag, die Anträge', 'der Antrag', 'de').ok).toBe(true);
    expect(gradeAnswer('der/die Angestellte', 'der', 'de').ok).toBe(false);
  });

  it('lenient (speech) mode accepts the phrase inside a longer answer', () => {
    expect(gradeAnswer('Bescheid geben', 'ich muss dir Bescheid geben', 'de', true).ok).toBe(true);
    expect(gradeAnswer('Bescheid geben', 'ich muss dir Bescheid geben', 'de').ok).toBe(false);
    expect(gradeAnswer('die Frist', 'wir haben der Frist', 'de', true)).toEqual({ verdict: 'article', ok: false });
  });

  it('empty answer is wrong', () => {
    expect(gradeAnswer('die Frist', '   ', 'de')).toEqual({ verdict: 'wrong', ok: false });
  });

  it('levenshtein', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('parseImport', () => {
  it('splits on tab, dashes, = and ; and keeps an optional example', () => {
    const r = parseImport('der Antrag\tзаявление\tIch stelle einen Antrag.\nBescheid geben — сообщить\nlüften - проветривать\nklappen = получаться\nsich kümmern; заботиться; Ich kümmere mich.\n\nnur Wort');
    expect(r).toEqual([
      { term: 'der Antrag', definition: 'заявление', example: 'Ich stelle einen Antrag.' },
      { term: 'Bescheid geben', definition: 'сообщить', example: '' },
      { term: 'lüften', definition: 'проветривать', example: '' },
      { term: 'klappen', definition: 'получаться', example: '' },
      { term: 'sich kümmern', definition: 'заботиться', example: 'Ich kümmere mich.' },
      { term: 'nur Wort', definition: '', example: '' },
    ]);
  });

  it('does not split hyphenated words and skips duplicates', () => {
    expect(parseImport('E-Mail — письмо\ne-mail — ещё раз')).toEqual([{ term: 'E-Mail', definition: 'письмо', example: '' }]);
  });
});

describe('learn', () => {
  const ids = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  it('asks a choice first, then writing, rounds of 7', () => {
    let s = startLearn(ids, seeded(1));
    expect(s.queue).toHaveLength(ROUND_SIZE);
    const first = current(s)!;
    expect(first.step).toBe('mc');
    s = answer(s, true);
    expect(s.progress[first.id]).toBe(1);
    expect(s.queue).not.toContain(first.id); // passed the choice: back next round for writing
  });

  it('a wrong answer moves the card to the end of the round', () => {
    let s = startLearn(ids, seeded(2));
    const id = current(s)!.id;
    s = answer(s, false);
    expect(s.queue[s.queue.length - 1]).toBe(id);
    expect(s.progress[id]).toBe(0);
  });

  it('finishes when every card passed both steps', () => {
    let s = startLearn(ids, seeded(3));
    let guard = 0;
    while (!isFinished(s) && guard++ < 200) {
      if (s.roundDone) s = continueLearn(s);
      else s = answer(s, true);
    }
    expect(isFinished(s)).toBe(true);
    expect(learnedCount(s)).toBe(ids.length);
    expect(s.round).toBeGreaterThan(2);
  });

  it('with one card there is no choice step', () => {
    const s = startLearn(['x']);
    expect(current(s)).toEqual({ id: 'x', step: 'write' });
  });
});

describe('questions', () => {
  it('choices: right answer + up to 3 distinct distractors', () => {
    const opts = choices(deck[0], deck, 'ru-de', seeded(4));
    expect(opts).toHaveLength(4);
    expect(opts).toContain('der Antrag');
    expect(new Set(opts).size).toBe(4);
    expect(choices(deck[0], deck.slice(0, 2), 'de-ru')).toHaveLength(2);
  });

  it('true/false shows either the right answer or a wrong one, and says which', () => {
    const rng = seeded(5);
    for (let i = 0; i < 20; i++) {
      const q = buildQuestion('tf', deck[2], deck, 'de-ru', rng);
      expect(q.prompt).toBe('die Frist');
      expect(q.shownIsRight).toBe(q.shown === 'срок');
    }
  });

  it('buildTest spreads the types and never repeats a card', () => {
    const t = buildTest(deck, 10, ['mc', 'write', 'tf'], 'ru-de', seeded(6));
    expect(t).toHaveLength(5);
    expect(new Set(t.map((q) => q.card.id)).size).toBe(5);
    expect(t.map((q) => q.type)).toEqual(['mc', 'write', 'tf', 'mc', 'write']);
    expect(buildTest([deck[0]], 5, ['mc', 'tf'], 'ru-de').map((q) => q.type)).toEqual(['write']);
    expect(buildTest([card('z', 'Wort', '')], 5, ['mc'], 'ru-de')).toEqual([]);
  });
});

describe('match', () => {
  it('builds 2 tiles per pair, max 6 pairs', () => {
    const many = Array.from({ length: 10 }, (_, i) => card(`${i}`, `t${i}`, `d${i}`));
    const tiles = buildMatch(many, seeded(7));
    expect(tiles).toHaveLength(12);
    const [a] = tiles;
    const partner = tiles.find((t) => t.pairId === a.pairId && t.key !== a.key)!;
    expect(isPair(a, partner)).toBe(true);
    expect(isPair(a, a)).toBe(false);
  });
});

describe('mastery', () => {
  it('new → learning → known after 2 in a row; a mistake resets', () => {
    let s = emptyStats();
    expect(masteryOf(s)).toBe('new');
    s = nextStats(s, true, 1);
    expect(masteryOf(s)).toBe('learning');
    s = nextStats(s, true, 2);
    expect(masteryOf(s)).toBe('known');
    s = nextStats(s, false, 3);
    expect(s).toEqual({ seen: 3, correct: 2, wrong: 1, streak: 0, lastAt: 3 });
    expect(masteryCounts([{ stats: s }, { stats: emptyStats() }])).toEqual({ new: 1, learning: 1, known: 0 });
  });
});

describe('random', () => {
  it('seeded shuffle is deterministic and keeps all items', () => {
    expect(shuffle([1, 2, 3, 4, 5], seeded(9))).toEqual(shuffle([1, 2, 3, 4, 5], seeded(9)));
    expect(shuffle([1, 2, 3, 4, 5], seeded(9)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
