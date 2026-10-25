import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { shouldRemind } from '../components/BackupBanner';
import { db } from '../db/db';
import { exportAll, getSetting, setSetting } from '../db/repo';
import { SettingsPage } from './SettingsPage';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('backup', () => {
  it('export never contains the API key', async () => {
    await setSetting('apiKey', 'SECRET-KEY-123');
    expect(JSON.stringify(await exportAll())).not.toContain('SECRET-KEY-123');
  });
});

describe('shouldRemind', () => {
  const now = new Date('2026-10-25T12:00:00');
  const base = { items: 10, lastExportAt: 0, dismissedDay: '', now };
  it('needs at least 5 items', () => expect(shouldRemind({ ...base, items: 4 })).toBe(false));
  it('reminds when never exported', () => expect(shouldRemind(base)).toBe(true));
  it('quiet after a recent export', () =>
    expect(shouldRemind({ ...base, lastExportAt: now.getTime() - 86400000 })).toBe(false));
  it('reminds after a week', () =>
    expect(shouldRemind({ ...base, lastExportAt: now.getTime() - 8 * 86400000 })).toBe(true));
  it('quiet when dismissed today', () =>
    expect(shouldRemind({ ...base, dismissedDay: '2026-10-25' })).toBe(false));
});

describe('SettingsPage', () => {
  it('saves the API key to settings', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    const input = await screen.findByLabelText('Ключ Gemini API');
    await user.type(input, 'abc');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await getSetting('apiKey', '')).toBe('abc');
  });
});
