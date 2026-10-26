import { useMemo, useState } from 'react';
import { recordAnswer } from '../../../db/repo';
import { ruWords } from '../../../i18n/ru';
import { gradeAnswer } from '../../../words/grade';
import { answerLang, askable, buildTest, type QuestionType, type TestQuestion } from '../../../words/questions';
import { CardEmoji } from '../CardEmoji';
import { StudyHeader } from '../StudyHeader';
import type { ModeProps } from './types';

const COUNTS = [10, 20, 0]; // 0 = all
const ALL_TYPES: QuestionType[] = ['mc', 'write', 'tf'];

interface Answered { q: TestQuestion; given: string; ok: boolean }

function isRight(q: TestQuestion, given: string, lang: 'de' | 'ru'): boolean {
  if (q.type === 'mc') return given === q.answer;
  if (q.type === 'tf') return (given === 'yes') === q.shownIsRight;
  return gradeAnswer(q.answer, given, lang).ok;
}

export function TestMode({ cards, direction, onExit }: ModeProps) {
  const pool = useMemo(() => askable(cards), [cards]);
  const lang = answerLang(direction);
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<QuestionType[]>(ALL_TYPES);
  const [questions, setQuestions] = useState<TestQuestion[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answered[]>([]);
  const [text, setText] = useState('');

  function start() {
    setQuestions(buildTest(pool, count === 0 ? pool.length : count, types, direction));
    setIdx(0);
    setAnswers([]);
    setText('');
  }

  function give(given: string) {
    if (!questions) return;
    const q = questions[idx];
    const ok = isRight(q, given, lang);
    const next = [...answers, { q, given, ok }];
    setAnswers(next);
    setText('');
    setIdx(idx + 1);
    if (idx + 1 >= questions.length) {
      for (const a of next) void recordAnswer(a.q.card.id, 'test', a.ok);
    }
  }

  const toggleType = (t: QuestionType) =>
    setTypes((cur) => (cur.includes(t) ? (cur.length > 1 ? cur.filter((x) => x !== t) : cur) : [...cur, t]));

  // ---------- setup ----------
  if (!questions) {
    return (
      <section className="page">
        <StudyHeader title={ruWords.mode.test} onExit={onExit} />
        <div className="card">
          <h2>{ruWords.testSetup}</h2>
          <p className="small muted">{ruWords.questions}</p>
          <div className="chips">
            {COUNTS.map((n) => (
              <button key={n} type="button" className="chip" aria-pressed={count === n} onClick={() => setCount(n)}>
                {n === 0 ? `${ruWords.allQuestions} (${pool.length})` : n}
              </button>
            ))}
          </div>
          <p className="small muted">{ruWords.types}</p>
          <div className="chips">
            {ALL_TYPES.map((t) => (
              <button key={t} type="button" className="chip" aria-pressed={types.includes(t)} onClick={() => toggleType(t)}>
                {ruWords.type[t]}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="btn primary block" onClick={start}>{ruWords.start}</button>
      </section>
    );
  }

  // ---------- result ----------
  if (idx >= questions.length) {
    const ok = answers.filter((a) => a.ok).length;
    const pct = Math.round((ok / Math.max(1, answers.length)) * 100);
    const wrong = answers.filter((a) => !a.ok);
    return (
      <section className="page">
        <StudyHeader title={ruWords.mode.test} onExit={onExit} />
        <div className="card center">
          <div className={`score ${pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'low'}`}>{ruWords.score(pct)}</div>
          <p role="status">{ruWords.scoreLine(ok, answers.length)}</p>
        </div>
        <h2>{ruWords.mistakes}</h2>
        {wrong.length === 0 && <p className="muted">{ruWords.noMistakes}</p>}
        {wrong.map((a, i) => (
          <div key={i} className="card mistake">
            <p className="small muted">{ruWords.type[a.q.type]}</p>
            <p><strong>{a.q.prompt}</strong>{a.q.type === 'tf' && <> — {a.q.shown}</>}</p>
            <p className="small"><span className="muted">{ruWords.yourAnswer}: </span>
              <span className="error">{a.q.type === 'tf' ? (a.given === 'yes' ? ruWords.yes : ruWords.no) : a.given || ruWords.skipped}</span>
            </p>
            <p className="small"><span className="muted">{ruWords.rightAnswer}: </span><strong>{a.q.answer}</strong></p>
          </div>
        ))}
        <button type="button" className="btn primary block" onClick={start}>{ruWords.newTest}</button>
        <button type="button" className="btn block mt" onClick={onExit}>{ruWords.backToDeck}</button>
      </section>
    );
  }

  // ---------- question ----------
  const q = questions[idx];
  return (
    <section className="page">
      <StudyHeader title={ruWords.mode.test} index={idx} total={questions.length} onExit={onExit} />
      <p className="muted small">{ruWords.type[q.type]}</p>
      <div className="prompt-card" lang={direction === 'ru-de' ? 'ru' : 'de'}><CardEmoji card={q.card} />{q.prompt}</div>

      {q.type === 'mc' && (
        <div className="choices">
          {q.options.map((o) => (
            <button key={o} type="button" className="choice" lang={lang} onClick={() => give(o)}>{o}</button>
          ))}
        </div>
      )}

      {q.type === 'tf' && (
        <>
          <p className="muted small">{ruWords.isItRight}</p>
          <div className="prompt-card secondary" lang={lang}>{q.shown}</div>
          <div className="grade-row">
            <button type="button" className="btn grade-good" onClick={() => give('yes')}>{ruWords.yes}</button>
            <button type="button" className="btn grade-bad" onClick={() => give('no')}>{ruWords.no}</button>
          </div>
        </>
      )}

      {q.type === 'write' && (
        <form className="write-form" onSubmit={(e) => { e.preventDefault(); give(text); }}>
          <input
            key={idx}
            autoFocus
            type="text"
            lang={lang}
            aria-label={ruWords.answerPh}
            placeholder={lang === 'de' ? ruWords.answerDePh : ruWords.answerRuPh}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="row">
            <button type="submit" className="btn primary">{ruWords.next}</button>
          </div>
        </form>
      )}
    </section>
  );
}
