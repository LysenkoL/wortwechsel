// Question building for "Заучивание" and "Тест" (pure, testable).
import type { WordCard } from '../db/types';
import { normalize, type AnswerLang } from './grade';
import { sample, shuffle, type Rng } from './random';

/** ru-de: show Russian, answer in German (active vocabulary, default). de-ru: the other way round. */
export type Direction = 'ru-de' | 'de-ru';
export type QuestionType = 'mc' | 'write' | 'tf';

export type StudyCard = Pick<WordCard, 'id' | 'term' | 'definition' | 'example' | 'note' | 'emoji'>;

export const promptOf = (c: StudyCard, d: Direction) => (d === 'ru-de' ? c.definition : c.term);
export const answerOf = (c: StudyCard, d: Direction) => (d === 'ru-de' ? c.term : c.definition);
export const answerLang = (d: Direction): AnswerLang => (d === 'ru-de' ? 'de' : 'ru');

/** Cards that can be asked in this direction (both sides filled). */
export const askable = <T extends StudyCard>(cards: T[]): T[] => cards.filter((c) => c.term.trim() && c.definition.trim());

/** Up to 4 options: the right answer + distractors with a different answer text. */
export function choices(card: StudyCard, pool: StudyCard[], d: Direction, rng: Rng = Math.random): string[] {
  const right = answerOf(card, d);
  const seen = new Set([normalize(right)]);
  const others: string[] = [];
  for (const c of shuffle(pool, rng)) {
    const a = answerOf(c, d);
    const key = normalize(a);
    if (c.id === card.id || !key || seen.has(key)) continue;
    seen.add(key);
    others.push(a);
    if (others.length === 3) break;
  }
  return shuffle([right, ...others], rng);
}

export interface TestQuestion {
  type: QuestionType;
  card: StudyCard;
  prompt: string;
  answer: string;
  options: string[]; // mc only
  shown: string; // tf only: the answer shown next to the prompt
  shownIsRight: boolean; // tf only
}

export function buildQuestion(
  type: QuestionType, card: StudyCard, pool: StudyCard[], d: Direction, rng: Rng = Math.random,
): TestQuestion {
  const base = { type, card, prompt: promptOf(card, d), answer: answerOf(card, d), options: [] as string[], shown: '', shownIsRight: true };
  if (type === 'mc') return { ...base, options: choices(card, pool, d, rng) };
  if (type === 'tf') {
    const wrong = choices(card, pool, d, rng).filter((o) => o !== base.answer);
    const useRight = wrong.length === 0 || rng() < 0.5;
    return { ...base, shown: useRight ? base.answer : wrong[0], shownIsRight: useRight };
  }
  return base;
}

/** A test of `count` questions, types spread evenly over `types` (mc needs ≥ 2 cards). */
export function buildTest(
  cards: StudyCard[], count: number, types: QuestionType[], d: Direction, rng: Rng = Math.random,
): TestQuestion[] {
  const pool = askable(cards);
  if (pool.length === 0 || types.length === 0) return [];
  const usable = pool.length < 2 ? types.filter((t) => t === 'write') : types;
  const kinds = usable.length ? usable : (['write'] as QuestionType[]);
  const picked = sample(pool, Math.min(count, pool.length), rng);
  return picked.map((card, i) => buildQuestion(kinds[i % kinds.length], card, pool, d, rng));
}
