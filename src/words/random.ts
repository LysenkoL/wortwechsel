export type Rng = () => number;

/** Fisher–Yates on a copy. */
export function shuffle<T>(list: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sample<T>(list: readonly T[], n: number, rng: Rng = Math.random): T[] {
  return shuffle(list, rng).slice(0, Math.max(0, n));
}

/** Deterministic generator for tests (mulberry32). */
export function seeded(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
