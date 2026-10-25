import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordButton } from './RecordButton';
import { ruSpeech } from '../i18n/ru';

const base = {
  supported: true, state: 'idle' as const, seconds: 0, finalText: '', interimText: '', error: null,
  onStart: vi.fn(), onStop: vi.fn(),
};

describe('RecordButton', () => {
  it('shows a fallback message when speech recognition is unsupported', () => {
    render(<RecordButton {...base} supported={false} />);
    expect(screen.getByText(ruSpeech.unsupported)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('starts on click and shows the timer while listening', async () => {
    const onStart = vi.fn();
    const { rerender } = render(<RecordButton {...base} onStart={onStart} />);
    await userEvent.click(screen.getByRole('button', { name: ruSpeech.tapToSpeak }));
    expect(onStart).toHaveBeenCalled();

    const onStop = vi.fn();
    rerender(<RecordButton {...base} state="listening" seconds={12} onStop={onStop} finalText="Hallo" interimText="Welt" />);
    expect(screen.getByRole('button', { name: ruSpeech.stop })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('0:12 / 1:00');
    expect(screen.getByText('Hallo', { exact: false })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: ruSpeech.stop }));
    expect(onStop).toHaveBeenCalled();
  });

  it('shows the matching error text', () => {
    render(<RecordButton {...base} state="error" error="denied" />);
    expect(screen.getByRole('alert')).toHaveTextContent(ruSpeech.denied);
  });
});
