import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ReviewPage } from './ReviewPage';
import { AiError } from '../ai/errors';
import type { EvaluateResponse, Suggestion } from '../ai/contracts.generated';
import { db } from '../db/db';
import * as repo from '../db/repo';
import { analyzeExamples } from '../features/speak/fixtures';
import { ruReview } from '../i18n/ru';

vi.mock('../ai/client', () => ({ evaluate: vi.fn() }));
import { evaluate } from '../ai/client';
const evaluateMock = vi.mocked(evaluate);

const ex1 = analyzeExamples[0];

async function seedDue(): Promise<string[]> {
  const { itemIds } = await repo.saveUtterance(
    { context: 'work', question: null, rawTranscript: '', transcript: ex1.input.transcript, analysis: ex1.output },
    ex1.output.suggestions as Suggestion[],
    new Date(2026, 9, 1),
  );
  await repo.makeAllDueNow();
  return itemIds;
}

const evalFor = (ids: string[], good: boolean[], over: Partial<EvaluateResponse> = {}): EvaluateResponse => ({
  meaning_preserved: true,
  targets: ids.map((id, i) => ({ id, used: good[i], correct: good[i], comment_ru: good[i] ? '' : 'Не то слово' })),
  naturalness: 'natural',
  errors: [],
  better_version: 'Er hat klargemacht, dass wir anders vorgehen müssen.',
  feedback_ru: 'Фидбек',
  ...over,
});

const renderPage = () => render(<MemoryRouter><ReviewPage /></MemoryRouter>);
const answer = async (text = 'Er hat klargemacht') => {
  await userEvent.click(await screen.findByRole('button', { name: ruReview.start }));
  await userEvent.type(screen.getByRole('textbox'), text);
};

beforeEach(async () => {
  evaluateMock.mockReset();
  await Promise.all([db.utterances.clear(), db.items.clear(), db.reviews.clear(), db.settings.clear()]);
});

describe('ReviewPage', () => {
  it('says there is nothing to do and when the next review is', async () => {
    await repo.saveUtterance(
      { context: 'work', question: null, rawTranscript: '', transcript: ex1.input.transcript, analysis: ex1.output },
      [ex1.output.suggestions[0]],
      new Date(),
    );
    renderPage();
    expect(await screen.findByText(ruReview.nothingDue)).toBeInTheDocument();
    expect(screen.getByText(/Следующее повторение:/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ruReview.start })).toBeNull();
  });

  it('shows a summary, highlights the target words and the task', async () => {
    await seedDue();
    renderPage();
    expect(await screen.findByText(ruReview.summary(2, 1))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: ruReview.start }));
    const marks = document.querySelectorAll('mark');
    expect([...marks].map((m) => m.textContent)).toEqual(['gesagt', 'das anders machen']);
    expect(screen.getByText(ruReview.progress(1, 1))).toBeInTheDocument();
  });

  it('checks the answer, records the review and finishes (Again + Hard)', async () => {
    const ids = await seedDue();
    evaluateMock.mockResolvedValueOnce(evalFor(ids, [false, true]));
    renderPage();
    await answer();
    await userEvent.click(screen.getByRole('button', { name: ruReview.check }));

    expect(evaluateMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'rephrase', sentence: ex1.input.transcript, answer: 'Er hat klargemacht',
      targets: expect.arrayContaining([expect.objectContaining({ id: ids[0] }), expect.objectContaining({ id: ids[1] })]),
    }));
    expect(await screen.findByText('Не то слово', { exact: false })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: ruReview.next }));

    expect(await screen.findByText(ruReview.done(2, 0))).toBeInTheDocument();
    const [review] = await db.reviews.toArray();
    expect(review.ratings).toEqual({ [ids[0]]: 1, [ids[1]]: 3 });
    expect(review.hintUsed).toBe(false);
  });

  it('a hint caps the rating at Hard', async () => {
    const ids = await seedDue();
    evaluateMock.mockResolvedValueOnce(evalFor(ids, [true, true]));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: ruReview.start }));
    await userEvent.click(screen.getByRole('button', { name: ruReview.hint }));
    expect(screen.getAllByText(/Значение:/)).toHaveLength(2);
    await userEvent.type(screen.getByRole('textbox'), 'Antwort');
    await userEvent.click(screen.getByRole('button', { name: ruReview.check }));
    await screen.findByText(ruReview.better);
    expect(screen.queryByLabelText(ruReview.easy)).toBeNull(); // no "easy" after a hint
    await userEvent.click(screen.getByRole('button', { name: ruReview.next }));
    await screen.findByText(ruReview.doneTitle);
    const [review] = await db.reviews.toArray();
    expect(Object.values(review.ratings)).toEqual([2, 2]);
    expect(review.hintUsed).toBe(true);
  });

  it('"easy" appears only for a clean answer and gives Easy', async () => {
    const ids = await seedDue();
    evaluateMock.mockResolvedValueOnce(evalFor(ids, [true, true]));
    renderPage();
    await answer();
    await userEvent.click(screen.getByRole('button', { name: ruReview.check }));
    await userEvent.click(await screen.findByLabelText(ruReview.easy));
    await userEvent.click(screen.getByRole('button', { name: ruReview.next }));
    await screen.findByText(ruReview.doneTitle);
    expect(Object.values((await db.reviews.toArray())[0].ratings)).toEqual([4, 4]);
  });

  it('stops the session on QUOTA and leaves items due', async () => {
    await seedDue();
    evaluateMock.mockRejectedValueOnce(new AiError('QUOTA'));
    renderPage();
    await answer();
    await userEvent.click(screen.getByRole('button', { name: ruReview.check }));
    expect(await screen.findByText(ruReview.quotaStop)).toBeInTheDocument();
    expect(await db.reviews.count()).toBe(0);
    expect(await repo.countDue()).toBe(2);
  });

  it('keeps the typed answer and offers a retry after a transient error', async () => {
    const ids = await seedDue();
    evaluateMock.mockRejectedValueOnce(new AiError('NETWORK')).mockResolvedValueOnce(evalFor(ids, [true, true]));
    renderPage();
    await answer('Meine Antwort');
    await userEvent.click(screen.getByRole('button', { name: ruReview.check }));
    await userEvent.click(await screen.findByRole('button', { name: 'Повторить' }));
    expect(await screen.findByText(ruReview.better)).toBeInTheDocument();
    expect(evaluateMock).toHaveBeenCalledTimes(2);
  });

  it('skipping rates nothing', async () => {
    await seedDue();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: ruReview.start }));
    await userEvent.click(screen.getByRole('button', { name: ruReview.skip }));
    expect(await screen.findByText(ruReview.done(0, 0))).toBeInTheDocument();
    expect(await db.reviews.count()).toBe(0);
    expect(await repo.countDue()).toBe(2);
  });

  it('respects the daily limit', async () => {
    await seedDue();
    await repo.setSetting('dailyReviewLimit', 1); // the only group has 2 items -> does not fit
    renderPage();
    expect(await screen.findByText(ruReview.nothingDue)).toBeInTheDocument();
  });
});
