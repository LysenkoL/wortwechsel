import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AnalysisView } from './AnalysisView';
import { analyzeExamples } from './fixtures';
import { SpeakPage } from '../../routes/SpeakPage';
import { AiError } from '../../ai/errors';
import { db } from '../../db/db';
import { ruAiError, ruSpeak } from '../../i18n/ru';

vi.mock('../../ai/client', () => ({ analyze: vi.fn() }));
import { analyze } from '../../ai/client';
const analyzeMock = vi.mocked(analyze);

const [ex1, ex2, ex3] = analyzeExamples;

describe('AnalysisView', () => {
  const noop = () => {};

  it('shows suggestions with a count on the save button; unchecking changes N', async () => {
    const onSave = vi.fn();
    render(<AnalysisView analysis={ex1.output} onSave={onSave} onSpeak={noop} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.getByRole('button', { name: `${ruSpeak.save} (2)` })).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('checkbox')[0]);
    await userEvent.click(screen.getByRole('button', { name: `${ruSpeak.save} (1)` }));
    expect(onSave).toHaveBeenCalledWith([ex1.output.suggestions[1]]);
  });

  it('says there is nothing to replace and offers to keep words when there are no suggestions', () => {
    render(<AnalysisView analysis={ex2.output} onSave={noop} onSpeak={noop} />);
    expect(screen.getByText(ruSpeak.nothingToReplace)).toBeInTheDocument();
    expect(screen.getByText(/gehe — /)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `${ruSpeak.save} (0)` })).toBeInTheDocument();
  });

  it('hides the grammar block when corrected_sentence is empty, shows it otherwise', () => {
    const { rerender } = render(<AnalysisView analysis={ex1.output} onSave={noop} onSpeak={noop} />);
    expect(screen.queryByRole('region', { name: ruSpeak.grammar })).toBeNull();
    rerender(<AnalysisView analysis={ex3.output} onSave={noop} onSpeak={noop} />);
    const grammar = screen.getByRole('region', { name: ruSpeak.grammar });
    expect(within(grammar).getByText(ex3.output.corrected_sentence)).toBeInTheDocument();
  });

  it('shows a message for non-German input', () => {
    render(<AnalysisView analysis={{ ...ex1.output, is_german: false }} onSave={noop} onSpeak={noop} />);
    expect(screen.getByRole('alert')).toHaveTextContent(ruSpeak.notGerman);
  });

  it('reads the improved sentence aloud', async () => {
    const onSpeak = vi.fn();
    render(<AnalysisView analysis={ex1.output} onSave={noop} onSpeak={onSpeak} />);
    await userEvent.click(screen.getByRole('button', { name: new RegExp(ruSpeak.listen) }));
    expect(onSpeak).toHaveBeenCalledWith(ex1.output.improved_sentence);
  });
});

describe('SpeakPage', () => {
  const renderPage = () => render(<MemoryRouter><SpeakPage /></MemoryRouter>);

  beforeEach(async () => {
    analyzeMock.mockReset();
    await Promise.all([db.utterances.clear(), db.items.clear(), db.settings.clear()]);
  });

  it('keeps Analyze disabled until there is text', async () => {
    renderPage();
    const button = screen.getByRole('button', { name: ruSpeak.analyze });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox'), 'Hallo');
    expect(button).toBeEnabled();
  });

  it('analyzes typed text, saves the chosen suggestions and resets', async () => {
    analyzeMock.mockResolvedValueOnce(ex1.output);
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Работа' }));
    await userEvent.type(screen.getByRole('textbox'), ex1.input.transcript);
    await userEvent.click(screen.getByRole('button', { name: ruSpeak.analyze }));

    expect(analyzeMock).toHaveBeenCalledWith({ transcript: ex1.input.transcript, context: 'work' });
    await userEvent.click(await screen.findByRole('button', { name: `${ruSpeak.save} (2)` }));

    expect(await screen.findByText(ruSpeak.saved(2))).toBeInTheDocument();
    expect(await db.items.count()).toBe(2);
    const [u] = await db.utterances.toArray();
    expect(u).toMatchObject({ context: 'work', transcript: ex1.input.transcript, rawTranscript: '' });
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it.each([
    [new AiError('NO_KEY'), ruAiError.noKey, true],
    [new AiError('QUOTA'), ruAiError.quota, false],
    [new AiError('NETWORK'), ruAiError.generic, false],
  ])('shows a friendly message for %s', async (err, text, hasSettingsLink) => {
    analyzeMock.mockRejectedValueOnce(err);
    renderPage();
    await userEvent.type(screen.getByRole('textbox'), 'Hallo Welt');
    await userEvent.click(screen.getByRole('button', { name: ruSpeak.analyze }));
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(!!screen.queryByRole('link', { name: ruAiError.toSettings })).toBe(hasSettingsLink);
    expect(screen.getByRole('textbox')).toHaveValue('Hallo Welt'); // text is not lost
  });

  it('offers a retry for transient errors and retries with the same text', async () => {
    analyzeMock.mockRejectedValueOnce(new AiError('TIMEOUT')).mockResolvedValueOnce(ex2.output);
    renderPage();
    await userEvent.type(screen.getByRole('textbox'), 'Ich gehe zum Arzt');
    await userEvent.click(screen.getByRole('button', { name: ruSpeak.analyze }));
    await userEvent.click(await screen.findByRole('button', { name: ruAiError.retry }));
    expect(await screen.findByText(ruSpeak.nothingToReplace)).toBeInTheDocument();
    expect(analyzeMock).toHaveBeenCalledTimes(2);
  });

  it('saves a phrase with zero selected suggestions', async () => {
    analyzeMock.mockResolvedValueOnce(ex2.output);
    renderPage();
    await userEvent.type(screen.getByRole('textbox'), 'Ich gehe zum Arzt');
    await userEvent.click(screen.getByRole('button', { name: ruSpeak.analyze }));
    await userEvent.click(await screen.findByRole('button', { name: `${ruSpeak.save} (0)` }));
    expect(await screen.findByText(ruSpeak.saved(0))).toBeInTheDocument();
    expect(await db.items.count()).toBe(0);
    expect(await db.utterances.count()).toBe(1);
  });
});
