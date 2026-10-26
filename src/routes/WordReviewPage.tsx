import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DEFAULT_NEW_PER_DAY, getSetting, getWordReviewQueue } from '../db/repo';
import type { WordCard } from '../db/types';
import { Review } from '../features/words/modes/Review';
import { ru } from '../i18n/ru';
import type { Direction } from '../words/questions';

export function WordReviewPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const deckId = params.get('deck') ?? undefined;
  const [queue, setQueue] = useState<WordCard[] | null>(null);
  const [direction, setDirection] = useState<Direction>('ru-de');

  useEffect(() => {
    let alive = true;
    (async () => {
      const perDay = await getSetting<number>('wordsNewPerDay', DEFAULT_NEW_PER_DAY);
      const dir = params.get('dir') ?? (await getSetting<Direction>('wordsDirection', 'ru-de'));
      const q = await getWordReviewQueue(new Date(), perDay, deckId);
      if (alive) {
        setDirection(dir === 'de-ru' ? 'de-ru' : 'ru-de');
        setQueue(q);
      }
    })();
    return () => { alive = false; };
  }, [deckId, params]);

  if (!queue) return <section className="page"><p className="muted">{ru.common.loading}</p></section>;
  return <Review queue={queue} direction={direction} onExit={() => navigate(deckId ? `/words/${deckId}` : '/words')} />;
}
