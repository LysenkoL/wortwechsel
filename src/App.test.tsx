import { render, screen } from '@testing-library/react';
import { App } from './App';
import { ru } from './i18n/ru';

describe('App shell', () => {
  it('renders the four navigation tabs', () => {
    render(<App />);
    for (const label of Object.values(ru.nav)) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
});
