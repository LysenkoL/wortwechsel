export interface Segment { text: string; mark: boolean }

/**
 * Splits `text` into segments, marking the first case-insensitive occurrence of
 * each needle. Overlapping needles are skipped. `missing` lists needles not found.
 */
export function highlight(text: string, needles: string[]): { segments: Segment[]; missing: string[] } {
  const lower = text.toLowerCase();
  const spans: { start: number; end: number }[] = [];
  const missing: string[] = [];

  for (const needle of needles) {
    const n = needle.trim().toLowerCase();
    const start = n ? lower.indexOf(n) : -1;
    if (start === -1) {
      missing.push(needle);
      continue;
    }
    const end = start + n.length;
    if (spans.some((s) => start < s.end && end > s.start)) continue; // overlaps an earlier mark
    spans.push({ start, end });
  }

  spans.sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let pos = 0;
  for (const s of spans) {
    if (s.start > pos) segments.push({ text: text.slice(pos, s.start), mark: false });
    segments.push({ text: text.slice(s.start, s.end), mark: true });
    pos = s.end;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos), mark: false });
  return { segments, missing };
}
