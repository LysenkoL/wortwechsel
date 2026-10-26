import { useEffect, useRef, useState } from 'react';
import { ruWords } from '../../i18n/ru';
import { gradeAnswer, type AnswerLang, type Grade } from '../../words/grade';

interface Props {
  expected: string;
  lang: AnswerLang;
  onDone: (ok: boolean) => void;
  /** Called right after checking (e.g. to read the right answer aloud). */
  onChecked?: (grade: Grade) => void;
}

/** After a right answer the next card comes by itself; a typo stays a little longer to read the spelling. */
export const AUTO_NEXT_MS = { correct: 900, typo: 2000 } as const;

/** Type the answer → tolerant check → right: next by itself; wrong: feedback with "Я была права" → next. */
export function WriteQuestion({ expected, lang, onDone, onChecked }: Props) {
  const [value, setValue] = useState('');
  const [grade, setGrade] = useState<Grade | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);

  const finished = useRef(false);
  const finish = (ok: boolean) => {
    if (finished.current) return;
    finished.current = true;
    onDone(ok);
  };

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (!grade) return;
    nextBtn.current?.focus();
    if (grade.verdict !== 'correct' && grade.verdict !== 'typo') return;
    const t = setTimeout(() => finish(true), AUTO_NEXT_MS[grade.verdict]);
    return () => clearTimeout(t);
  }, [grade]); // eslint-disable-line react-hooks/exhaustive-deps

  function check(given: string) {
    const g = gradeAnswer(expected, given, lang);
    setGrade(g);
    onChecked?.(g);
  }

  if (grade) {
    return (
      <div className={`feedback ${grade.ok ? 'ok' : 'bad'}`} role="status">
        <p className="feedback-title">{grade.ok ? '✓' : '✗'} {ruWords.verdict[grade.verdict]}</p>
        {value.trim() && !(grade.verdict === 'correct') && (
          <p className="small"><span className="muted">{ruWords.yourAnswer}: </span><span lang={lang}>{value}</span></p>
        )}
        <p><span className="muted small">{ruWords.rightAnswer}: </span><strong lang={lang}>{expected}</strong></p>
        <div className="row">
          <button ref={nextBtn} type="button" className="btn primary" onClick={() => finish(grade.ok)}>{ruWords.next}</button>
          {!grade.ok && value.trim() && (
            <button type="button" className="btn" onClick={() => finish(true)}>{ruWords.override}</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form className="write-form" onSubmit={(e) => { e.preventDefault(); if (value.trim()) check(value); }}>
      <input
        ref={input}
        type="text"
        lang={lang}
        aria-label={lang === 'de' ? ruWords.answerDePh : ruWords.answerRuPh}
        placeholder={lang === 'de' ? ruWords.answerDePh : ruWords.answerRuPh}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="row">
        <button type="submit" className="btn primary" disabled={!value.trim()}>{ruWords.check}</button>
        <button type="button" className="btn" onClick={() => check('')}>{ruWords.dontKnow}</button>
      </div>
    </form>
  );
}
