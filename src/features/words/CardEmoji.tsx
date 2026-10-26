import type { WordCard } from '../../db/types';

/** Association emoji of a card, decorative (the word itself is always in text). */
export function CardEmoji({ card, size = 'md' }: { card: Pick<WordCard, 'emoji'>; size?: 'sm' | 'md' | 'lg' }) {
  if (!card.emoji) return null;
  return <span className={`card-emoji ${size}`} aria-hidden="true">{card.emoji}</span>;
}
