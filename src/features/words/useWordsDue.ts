import { useLiveQuery } from 'dexie-react-hooks';
import { countWordsDue, DEFAULT_NEW_PER_DAY, getSetting } from '../../db/repo';

/** Words due for spaced repetition today (badge on the "Слова" tab). */
export function useWordsDue(): number {
  return (
    useLiveQuery(async () => {
      const perDay = await getSetting<number>('wordsNewPerDay', DEFAULT_NEW_PER_DAY);
      return countWordsDue(new Date(), perDay);
    }, []) ?? 0
  );
}
