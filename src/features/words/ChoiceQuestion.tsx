import { useEffect, useRef, useState } from 'react';
import { ruWords } from '../../i18n/ru';

interface Props {
  options: string[];
  answer: string;
  lang: 'de' | 'ru';
  onDone: (ok: boolean) => void;
}

/** Four options. Right → short pause and go on; wrong → show the right one and wait for "Дальше". */
export function ChoiceQuestion({ options, answer, lang, onDone }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const ok = picked === answer;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function pick(o: string) {
    if (picked !== null) return;
    setPicked(o);
    if (o === answer) timer.current = setTimeout(() => onDone(true), 600);
  }

  return (
    <div>
      <div className="choices">
        {options.map((o) => {
          const state = picked === null ? '' : o === answer ? ' right' : o === picked ? ' wrong' : ' dim';
          return (
            <button key={o} type="button" lang={lang} className={`choice${state}`} onClick={() => pick(o)} disabled={picked !== null && o !== picked && o !== answer}>
              {o}
            </button>
          );
        })}
      </div>
      {picked !== null && !ok && (
        <button type="button" className="btn primary block" onClick={() => onDone(false)}>{ruWords.next}</button>
      )}
    </div>
  );
}
