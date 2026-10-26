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

/** Type the answer → tolerant check → feedback with "Я была права" → next. */
export function WriteQuestion({ expected, lang, onDone, onChecked }: Props) {
  const [value, setValue] = useState('');
  const [grade, setGrade] = useState<Grade | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { if (grade) nextBtn.current?.focus(); }, [grade]);

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
          <button ref={nextBtn} type="button" className="btn primary" onClick={() => onDone(grade.ok)}>{ruWords.next}</button>
          {!grade.ok && value.trim() && (
            <button type="button" className="btn" onClick={() => onDone(true)}>{ruWords.override}</button>
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
