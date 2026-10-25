const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const lc = (a: string[]) => a.map((w) => w.toLowerCase());

/**
 * Appends `next` to `acc` without duplicating words. Chrome on Android repeats
 * growing phrases ("Ich" / "Ich habe" / "Ich habe gesagt"), so a segment that
 * extends or repeats what we already have must replace/skip, not be appended.
 */
export function mergeText(acc: string, next: string): string {
  const aw = words(acc);
  const nw = words(next);
  if (nw.length === 0) return aw.join(' ');
  if (aw.length === 0) return nw.join(' ');
  const al = lc(aw);
  const nl = lc(nw);

  // next already contains everything we have: it is the longer version
  if (nl.length >= al.length && al.every((w, i) => w === nl[i])) return nw.join(' ');
  // we already have next (as the tail): nothing new
  if (al.length >= nl.length && nl.every((w, i) => w === al[al.length - nl.length + i])) return aw.join(' ');
  // overlap of at least two words at the seam
  for (let k = Math.min(al.length, nl.length) - 1; k >= 2; k--) {
    if (al.slice(al.length - k).every((w, i) => w === nl[i])) return [...aw, ...nw.slice(k)].join(' ');
  }
  return [...aw, ...nw].join(' ');
}
