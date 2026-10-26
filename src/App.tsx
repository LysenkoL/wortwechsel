import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { backfillStarterEmoji } from './db/repo';
import { STARTER_DECKS } from './words/starters';
import { TopBar } from './components/TopBar';
import { NavBar } from './components/NavBar';
import { useDueCount } from './features/review/useDueCount';
import { SpeakPage } from './routes/SpeakPage';
import { ReviewPage } from './routes/ReviewPage';
import { ExpressionsPage } from './routes/ExpressionsPage';
import { SettingsPage } from './routes/SettingsPage';
import { WordsPage } from './routes/WordsPage';
import { DeckPage } from './routes/DeckPage';
import { StudyPage } from './routes/StudyPage';
import { WordReviewPage } from './routes/WordReviewPage';
import { useWordsDue } from './features/words/useWordsDue';

function Shell() {
  const due = useDueCount();
  const wordsDue = useWordsDue();
  useEffect(() => { void backfillStarterEmoji(STARTER_DECKS); }, []);
  return (
    <div className="app">
      <TopBar due={due} />
      <Routes>
        <Route path="/speak" element={<SpeakPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/words" element={<WordsPage />} />
        <Route path="/words/review" element={<WordReviewPage />} />
        <Route path="/words/:deckId" element={<DeckPage />} />
        <Route path="/words/:deckId/:mode" element={<StudyPage />} />
        <Route path="/expressions" element={<ExpressionsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/speak" replace />} />
      </Routes>
      <NavBar dueCount={due} wordsDue={wordsDue} />
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
