import type { Deck, WordCard } from '../../../db/types';
import type { Direction } from '../../../words/questions';

export interface ModeProps {
  deck: Deck;
  cards: WordCard[];
  direction: Direction;
  onExit: () => void;
}
