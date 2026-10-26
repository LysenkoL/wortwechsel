import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { db } from '../db/db';
import * as repo from '../db/repo';
import { ruWords } from '../i18n/ru';
import { STARTER_DECKS } from '../words/starters';
import { DeckPage } from './DeckPage';
import { StudyPage } from './StudyPage';
import { WordReviewPage } from './WordReviewPage';
import { WordsPage } from './WordsPage';

vi.mock('../ai/client', () => ({ generateCards: vi.fn() }));
import { generateCards } from '../ai/client';
const generateMock = vi.mocked(generateCards);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/words" element={<WordsPage />} />
        <Route path="/words/review" element={<WordReviewPage />} />
        <Route path="/words/:deckId" element={<DeckPage />} />
        <Route path="/words/:deckId/:mode" element={<StudyPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function seedDeck(cards: { term: string; definition: string }[]) {
  const deckId = await repo.createDeck({ title: 'Test', emoji: '📘', context: 'work', description: '' });
  await repo.addCards(deckId, cards);
  return deckId;
}

const FIVE = [
  { term: 'der Antrag', definition: 'заявление' },
  { term: 'die Frist', definition: 'срок' },
  { term: 'Bescheid geben', definition: 'сообщить' },
  { term: 'lüften', definition: 'проветривать' },
  { term: 'der Befund', definition: 'результат обследования' },
];

beforeEach(async () => {
  generateMock.mockReset();
  await Promise.all([db.decks.clear(), db.cards.clear(), db.wordLog.clear(), db.settings.clear(), db.items.clear()]);
});

describe('WordsPage', () => {
  it('adds a starter deck and shows it in its topic group', async () => {
    const user = userEvent.setup();
    renderAt('/words');
    const s = STARTER_DECKS[0];
    await user.click(await screen.findByRole('button', { name: `${ruWords.addStarter}: ${s.title}` }));
    const link = await screen.findByRole('link', { name: new RegExp(s.title) });
    expect(link).toHaveTextContent(ruWords.deckCount(s.cards.length));
    expect(screen.queryByRole('button', { name: `${ruWords.addStarter}: ${s.title}` })).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: ruWords.reviewStart })).toBeEnabled());
    expect(screen.getByText(ruWords.reviewDue(12))).toBeInTheDocument();
  });

  it('creates a deck and opens it', async () => {
    const user = userEvent.setup();
    renderAt('/words');
    await user.click(await screen.findByRole('button', { name: ruWords.newDeck }));
    await user.type(screen.getByLabelText(ruWords.deckTitle), 'Behörde');
    await user.click(screen.getByRole('button', { name: ruWords.create }));
    expect(await screen.findByRole('heading', { name: 'Behörde' })).toBeInTheDocument();
    expect(screen.getByText(ruWords.noCards)).toBeInTheDocument();
  });
});

describe('DeckPage', () => {
  it('imports a pasted list and enables the training modes', async () => {
    const user = userEvent.setup();
    const deckId = await seedDeck([]);
    renderAt(`/words/${deckId}`);
    expect(await screen.findByRole('button', { name: new RegExp(ruWords.mode.test) })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: ruWords.importList }));
    await user.type(screen.getByLabelText(ruWords.importList), 'der Antrag — заявление{enter}die Frist — срок');
    expect(screen.getByText(ruWords.importPreview(2))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: ruWords.add }));
    expect(await screen.findByText(ruWords.added(2))).toBeInTheDocument();
    expect(await screen.findByText('der Antrag')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(ruWords.mode.test) })).toBeEnabled();
  });

  it('AI: adds generated cards for the deck topic, excluding existing terms', async () => {
    const user = userEvent.setup();
    const deckId = await seedDeck([{ term: 'der Termin', definition: 'встреча' }]);
    generateMock.mockResolvedValueOnce({ cards: [{ term: 'die Frist', definition_ru: 'срок', example_de: 'Die Frist läuft.', note_ru: '' }] });
    renderAt(`/words/${deckId}`);
    await user.click(await screen.findByRole('button', { name: ruWords.aiTopic }));
    await user.click(screen.getByRole('button', { name: ruWords.aiGenerate }));
    expect(await screen.findByText('die Frist')).toBeInTheDocument();
    expect(generateMock).toHaveBeenCalledWith(expect.objectContaining({ mode: 'topic', topic: 'Test', count: 10, exclude: ['der Termin'] }));
  });

  it('AI: completes cards without translation, keeping what she typed', async () => {
    const user = userEvent.setup();
    const deckId = await seedDeck([{ term: 'Besprechung', definition: '' }]);
    generateMock.mockResolvedValueOnce({ cards: [{ term: 'die Besprechung', definition_ru: 'совещание', example_de: 'Die Besprechung beginnt.', note_ru: 'мн. die Besprechungen' }] });
    renderAt(`/words/${deckId}`);
    await user.click(await screen.findByRole('button', { name: ruWords.aiComplete(1) }));
    expect(await screen.findByText('совещание')).toBeInTheDocument();
    const [c] = await repo.listCards(deckId);
    expect(c).toMatchObject({ term: 'Besprechung', definition: 'совещание', example: 'Die Besprechung beginnt.' });
  });
});

describe('training modes', () => {
  it('flashcards: flip, "Знаю" / "Ещё учу", then repeat the unknown ones', async () => {
    const user = userEvent.setup();
    const deckId = await seedDeck(FIVE.slice(0, 2));
    renderAt(`/words/${deckId}/flashcards?dir=de-ru`);
    const card = await screen.findByRole('button', { name: ruWords.tapToFlip });
    const front = card.textContent ?? '';
    await user.click(card);
    expect(card.textContent).not.toBe(front);
    await user.click(screen.getByRole('button', { name: ruWords.know }));
    await user.click(screen.getByRole('button', { name: ruWords.stillLearning }));
    expect(await screen.findByText(ruWords.fcDone(1, 1))).toBeInTheDocument();
    const stats = (await repo.listCards(deckId)).map((c) => c.stats.seen);
    expect(stats).toEqual([1, 1]);
    await user.click(screen.getByRole('button', { name: ruWords.repeatUnknown(1) }));
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });

  it('write: an article mistake is not accepted, "Я была права" overrides it', async () => {
    const user = userEvent.setup();
    const deckId = await seedDeck([FIVE[1]]);
    renderAt(`/words/${deckId}/write`);
    await user.type(await screen.findByLabelText(ruWords.answerDePh), 'der frist{enter}');
    expect(screen.getByText(new RegExp(ruWords.verdict.article))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: ruWords.override }));
    expect(await screen.findByText(ruWords.scoreLine(1, 1))).toBeInTheDocument();
    expect((await repo.listCards(deckId))[0].stats).toMatchObject({ correct: 1, wrong: 0 });
  });

  it('learn: a choice question first, the right option goes on', async () => {
    const user = userEvent.setup();
    const deckId = await seedDeck(FIVE);
    renderAt(`/words/${deckId}/learn`);
    expect(await screen.findByText(ruWords.chooseRight)).toBeInTheDocument();
    const prompt = document.querySelector('.prompt-card')!.textContent!;
    const right = FIVE.find((c) => c.definition === prompt)!.term;
    await user.click(screen.getByRole('button', { name: right }));
    await waitFor(() => expect(document.querySelector('.prompt-card')!.textContent).not.toBe(prompt), { timeout: 2000 });
    expect(screen.getByText(ruWords.chooseRight)).toBeInTheDocument();
    expect(await repo.wordStats()).toMatchObject({ answers: 1, correct: 1 });
  });

  it('test: answers every question and shows the score with mistakes', async () => {
    const user = userEvent.setup();
    const deckId = await seedDeck(FIVE.slice(0, 2));
    renderAt(`/words/${deckId}/test`);
    await user.click(await screen.findByRole('button', { name: ruWords.type.mc })); // off
    await user.click(screen.getByRole('button', { name: ruWords.type.tf })); // off → only writing
    await user.click(screen.getByRole('button', { name: ruWords.start }));
    for (let i = 0; i < 2; i++) {
      const prompt = document.querySelector('.prompt-card')!.textContent!;
      const right = FIVE.find((c) => c.definition === prompt)!.term;
      await user.type(screen.getByLabelText(ruWords.answerPh), `${i === 0 ? right : 'falsch'}{enter}`);
    }
    expect(await screen.findByText(ruWords.score(50))).toBeInTheDocument();
    expect(screen.getByText(ruWords.scoreLine(1, 2))).toBeInTheDocument();
    expect(screen.getByText('falsch')).toBeInTheDocument();
  });

  it('match: pairing all tiles finishes the game and stores the record', async () => {
    const user = userEvent.setup();
    const deckId = await seedDeck(FIVE.slice(0, 3));
    renderAt(`/words/${deckId}/match`);
    await user.click(await screen.findByRole('button', { name: ruWords.start }));
    for (const c of FIVE.slice(0, 3)) {
      await user.click(screen.getByRole('button', { name: c.term }));
      await user.click(screen.getByRole('button', { name: c.definition }));
    }
    expect(await screen.findByText(ruWords.newRecord)).toBeInTheDocument();
    expect((await repo.getDeck(deckId))?.bestMatchMs).toBeGreaterThan(0);
  });

  it('review: show answer and rate → the card goes into FSRS', async () => {
    const user = userEvent.setup();
    const deckId = await seedDeck([FIVE[0]]);
    renderAt(`/words/review?deck=${deckId}`);
    expect(await screen.findByText('заявление')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: ruWords.showAnswer }));
    expect(within(document.querySelector('.answer-text') as HTMLElement).getByText('der Antrag')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: ruWords.ratings[3] }));
    expect(await screen.findByText(ruWords.reviewDone(1))).toBeInTheDocument();
    const [c] = await repo.listCards(deckId);
    expect(c.card.reps).toBe(1);
    expect(c.due).toBeGreaterThan(Date.now());
  });
});
