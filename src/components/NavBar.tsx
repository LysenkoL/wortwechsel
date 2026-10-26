import { NavLink } from 'react-router-dom';
import { ru } from '../i18n/ru';

const icons = {
  speak: <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z" />,
  review: <path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7Z" />,
  words: <path d="M7 3h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7V3Zm-3 3h2v15h11v2H6a2 2 0 0 1-2-2V6Zm6 2v2h7V8h-7Zm0 4v2h5v-2h-5Z" />,
  expressions: <path d="M4 4h16v2H4V4Zm0 7h16v2H4v-2Zm0 7h10v2H4v-2Z" />,
  settings: <path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.6 7.6 0 0 0 1.7 1L11 21h4l.4-2.9a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.5L19.4 13ZM13 15.5A3.5 3.5 0 1 1 13 8.5a3.5 3.5 0 0 1 0 7Z" />,
};

type Tab = { to: string; key: keyof typeof icons };
const tabs: Tab[] = [
  { to: '/speak', key: 'speak' },
  { to: '/review', key: 'review' },
  { to: '/words', key: 'words' },
  { to: '/expressions', key: 'expressions' },
  { to: '/settings', key: 'settings' },
];

export function NavBar({ dueCount = 0, wordsDue = 0 }: { dueCount?: number; wordsDue?: number }) {
  return (
    <nav className="nav">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => (isActive ? 'active' : '')}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{icons[t.key]}</svg>
          <span>{ru.nav[t.key]}</span>
          {t.key === 'review' && dueCount > 0 && <span className="badge" aria-label={`${dueCount}`}>{dueCount}</span>}
          {t.key === 'words' && wordsDue > 0 && <span className="badge soft" aria-label={`${wordsDue}`}>{wordsDue}</span>}
        </NavLink>
      ))}
    </nav>
  );
}
