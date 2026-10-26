// Local answer checking for word training (no AI). Tolerant to what does not matter
// (case, punctuation, ß/ss, ä/ae, one typo), strict about what does (the article).

export type Verdict = 'correct' | 'typo' | 'article' | 'wrong';
export type AnswerLang = 'de' | 'ru';

export interface Grade {
  verdict: Verdict;
  ok: boolean; // correct or typo
}

const ARTICLES = new Set(['der', 'die', 'das']);
// Placeholders in patterns like "jdm. etw. vorschlagen" — never required in an answer.
const PLACEHOLDERS = new Set(['jd', 'jdm', 'jdn', 'jds', 'etw', 'sth', 'sb']);

export function normalize(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/ё/g, 'е')
    .replace(/[.,!?;:"'«»„“”‚‘’()[\]{}…–—\-/]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !PLACEHOLDERS.has(w))
    .join(' ');
}

/** Accepted alternatives of an expected answer. German: split on ; and /. Russian also on commas. */
export function alternatives(expected: string, lang: AnswerLang): string[] {
  const sep = lang === 'ru' ? /[;,/]/ : /[;/]/;
  // "(sich) vorstellen" → both with and without the bracketed part.
  const withBrackets = expected.replace(/[()]/g, '');
  const withoutBrackets = expected.replace(/\([^)]*\)/g, ' ');
  const parts = [expected, withBrackets, withoutBrackets, ...withoutBrackets.split(sep), ...withBrackets.split(sep)];
  const full = normalize(expected);
  const out: string[] = [];
  for (const p of parts) {
    const n = normalize(p);
    // Skip fragments like "что" from "дать понять, что" or a lone "der" from "der/die Angestellte".
    const fragment = n !== full && (ARTICLES.has(n) || (n.length < 4 && full.length > 8));
    if (n && !fragment && !out.includes(n)) out.push(n);
  }
  // A German noun often comes with its plural: "der Antrag, die Anträge" / "der Antrag, -¨e".
  if (lang === 'de') {
    const head = normalize(expected.split(',')[0]);
    if (head && !out.includes(head)) out.push(head);
  }
  return out;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

const typoBudget = (len: number) => (len >= 9 ? 2 : len >= 4 ? 1 : 0);

function stripArticle(s: string): { article: string | null; rest: string } {
  const [first, ...rest] = s.split(' ');
  return ARTICLES.has(first) && rest.length > 0 ? { article: first, rest: rest.join(' ') } : { article: null, rest: s };
}

function gradeOne(expected: string, given: string, lang: AnswerLang, lenient: boolean): Verdict {
  if (given === expected) return 'correct';
  if (lenient && ` ${given} `.includes(` ${expected} `)) return 'correct';

  if (lang === 'de') {
    const e = stripArticle(expected);
    const g = stripArticle(given);
    if (e.article && e.rest === g.rest && e.article !== g.article) return 'article';
    if (e.article && lenient && ` ${given} `.includes(` ${e.rest} `)) return 'article';
  }
  if (levenshtein(expected, given) <= typoBudget(expected.length)) {
    // A typo inside the article is still an article mistake.
    if (lang === 'de') {
      const e = stripArticle(expected);
      const g = stripArticle(given);
      if (e.article && g.article && e.article !== g.article) return 'article';
    }
    return 'typo';
  }
  return 'wrong';
}

const RANK: Record<Verdict, number> = { correct: 3, typo: 2, article: 1, wrong: 0 };

/**
 * Compare an answer with the expected text.
 * `lenient` (speech): the expected phrase may be surrounded by other words.
 */
export function gradeAnswer(expected: string, given: string, lang: AnswerLang, lenient = false): Grade {
  const g = normalize(given);
  if (!g) return { verdict: 'wrong', ok: false };
  let best: Verdict = 'wrong';
  for (const alt of alternatives(expected, lang)) {
    const v = gradeOne(alt, g, lang, lenient);
    if (RANK[v] > RANK[best]) best = v;
    if (best === 'correct') break;
  }
  return { verdict: best, ok: best === 'correct' || best === 'typo' };
}
