import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getDeck, listCards } from '../db/repo';
import type { Deck, StudyMode, WordCard } from '../db/types';
import { Flashcards } from '../features/words/modes/Flashcards';
import { Learn } from '../features/words/modes/Learn';
import { Match } from '../features/words/modes/Match';
import { SpeakMode } from '../features/words/modes/SpeakMode';
import { TestMode } from '../features/words/modes/TestMode';
import { Write } from '../features/words/modes/Write';
import { ru, ruWords } from '../i18n/ru';
import { askable, type Direction } from '../words/questions';

const MODES: StudyMode[] = ['flashcards', 'learn', 'write', 'listen', 'speak', 'test', 'match'];

export function StudyPage() {
  const { deckId = '', mode = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const direction: Direction = params.get('dir') === 'de-ru' ? 'de-ru' : 'ru-de';
  const starredOnly = params.get('starred') === '1';
  // Cards are read once: a session works on a fixed snapshot, stats are written as she answers.
  const [data, setData] = useState<{ deck: Deck; cards: WordCard[] } | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      const deck = await getDeck(deckId);
      const cards = deck ? await listCards(deckId) : [];
      if (alive) setData(deck ? { deck, cards: askable(starredOnly ? cards.filter((c) => c.starred) : cards) } : null);
    })();
    return () => { alive = false; };
  }, [deckId, starredOnly]);

  if (data === undefined) return <section className="page"><p className="muted">{ru.common.loading}</p></section>;
  if (data === null || !MODES.includes(mode as StudyMode) || data.cards.length === 0) {
    return (
      <section className="page">
        <p>{data === null ? ruWords.notFound : ruWords.needCards}</p>
        <Link className="btn" to={data ? `/words/${deckId}` : '/words'}>{ruWords.backToDeck}</Link>
      </section>
    );
  }

  const props = { deck: data.deck, cards: data.cards, direction, onExit: () => navigate(`/words/${deckId}`) };
  switch (mode as StudyMode) {
    case 'flashcards': return <Flashcards {...props} />;
    case 'learn': return <Learn {...props} />;
    case 'write': return <Write {...props} />;
    case 'listen': return <Write {...props} listen />;
    case 'speak': return <SpeakMode {...props} />;
    case 'test': return <TestMode {...props} />;
    default: return <Match {...props} />;
  }
}
