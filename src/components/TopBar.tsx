import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { countItems } from '../db/repo';
import { ruUi } from '../i18n/ru';

export function TopBar({ due }: { due: number }) {
  const stats = useLiveQuery(async () => ({
    total: await countItems(),
    active: await db.items.where('stage').equals('active').count(),
  }), []);
  return (
    <header className="topbar">
      <div className="brand">
        <svg className="logo" viewBox="0 0 48 48" aria-hidden="true">
          <rect width="48" height="48" rx="14" fill="url(#g)" />
          <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffb347" /><stop offset="1" stopColor="#ff6b6b" /></linearGradient></defs>
          <path d="M10 15l5 18 5-12 5 12 5-18M33 20h6M33 28h6" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <div>
          <div className="brand-name">{ruUi.brand}</div>
          <div className="brand-tag">{ruUi.tagline}</div>
        </div>
      </div>
      <div className="stats" aria-label="Статистика">
        <span className="stat"><b>{due}</b>{ruUi.statDue}</span>
        <span className="stat"><b>{stats?.total ?? 0}</b>{ruUi.statTotal}</span>
        <span className="stat"><b>{stats?.active ?? 0}</b>{ruUi.statActive}</span>
      </div>
    </header>
  );
}
