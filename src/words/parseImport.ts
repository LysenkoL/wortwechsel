// Quizlet-style bulk import: one card per line.
export interface ParsedCard {
  term: string;
  definition: string;
  example: string;
}

// Order matters: the first separator found in the line wins.
const SEPARATORS = ['\t', ' — ', ' – ', ' - ', ' = ', ';'];

export function parseImport(text: string): ParsedCard[] {
  const out: ParsedCard[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const sep = SEPARATORS.find((s) => line.includes(s));
    const parts = sep ? line.split(sep).map((p) => p.trim()) : [line];
    const term = parts[0];
    if (!term) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ term, definition: parts[1] ?? '', example: parts.slice(2).join(sep ?? '').trim() });
  }
  return out;
}
