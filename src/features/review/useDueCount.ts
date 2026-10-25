import { useLiveQuery } from 'dexie-react-hooks';
import { countDue, getSetting, reviewedTodayCount } from '../../db/repo';

export const DEFAULT_DAILY_LIMIT = 20;

/** Number shown on the "Повторить" tab: due items, capped by what is left of today's limit. */
export function useDueCount(): number {
  return (
    useLiveQuery(async () => {
      const limit = await getSetting<number>('dailyReviewLimit', DEFAULT_DAILY_LIMIT);
      const [due, done] = await Promise.all([countDue(), reviewedTodayCount()]);
      return Math.max(0, Math.min(due, limit - done));
    }, []) ?? 0
  );
}
