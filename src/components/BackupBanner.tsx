import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { countItems, getSetting, setSetting } from '../db/repo';
import { ruBackup } from '../i18n/ru';
import { localDay } from '../srs/scheduler';

const WEEK_MS = 7 * 24 * 3600 * 1000;
const MIN_ITEMS = 5;

export function shouldRemind(o: { items: number; lastExportAt: number; dismissedDay: string; now: Date }): boolean {
  if (o.items < MIN_ITEMS) return false;
  if (o.dismissedDay === localDay(o.now)) return false;
  return !o.lastExportAt || o.now.getTime() - o.lastExportAt > WEEK_MS;
}

export function BackupBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([countItems(), getSetting<number>('lastExportAt', 0), getSetting<string>('backupDismissedDay', '')]).then(
      ([items, lastExportAt, dismissedDay]) => {
        if (alive) setShow(shouldRemind({ items, lastExportAt, dismissedDay, now: new Date() }));
      },
    );
    return () => { alive = false; };
  }, []);

  if (!show) return null;
  return (
    <div className="notice" role="status">
      <span>{ruBackup.reminder}</span>
      <Link to="/settings">{ruBackup.toSettings}</Link>
      <button
        type="button"
        className="btn"
        onClick={async () => {
          setShow(false);
          await setSetting('backupDismissedDay', localDay(new Date()));
        }}
      >
        {ruBackup.close}
      </button>
    </div>
  );
}
