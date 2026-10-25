import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TopBar } from './components/TopBar';
import { NavBar } from './components/NavBar';
import { useDueCount } from './features/review/useDueCount';
import { SpeakPage } from './routes/SpeakPage';
import { ReviewPage } from './routes/ReviewPage';
import { ExpressionsPage } from './routes/ExpressionsPage';
import { SettingsPage } from './routes/SettingsPage';

function Shell() {
  const due = useDueCount();
  return (
    <div className="app">
      <TopBar due={due} />
      <Routes>
        <Route path="/speak" element={<SpeakPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/expressions" element={<ExpressionsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/speak" replace />} />
      </Routes>
      <NavBar dueCount={due} />
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
