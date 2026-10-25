import { EmptyState } from '../components/EmptyState';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { evaluate } from '../ai/client';
import { AiError } from '../ai/errors';
import type { EvaluateResponse } from '../ai/contracts.generated';
import { ErrorNotice } from '../components/ErrorNotice';
import { RecordButton } from '../components/RecordButton';
import { applyReview, getDueGroups, getSetting, nextDueAt, reviewedTodayCount } from '../db/repo';
import type { DueGroup } from '../db/types';
import { describeAiError, type DescribedError } from '../features/aiErrorText';
import { highlight } from '../features/review/highlight';
import { DEFAULT_DAILY_LIMIT } from '../features/review/useDueCount';
import { speakGerman } from '../features/speech/tts';
import { useSpeechRecognition } from '../features/speech/useSpeechRecognition';
import { ruReview, ruSpeech, ruUi } from '../i18n/ru';
import { rateTarget } from '../srs/rating';

type Phase = 'start' | 'task' | 'checking' | 'result' | 'done';

const fmtDate = (t: number) =>
  new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(t));

export function ReviewPage() {
  const navigate = useNavigate();
  const speech = useSpeechRecognition();

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<DueGroup[]>([]);
  const [nextDue, setNextDue] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('start');
  const [idx, setIdx] = useState(0);
  const [hint, setHint] = useState(0);
  const [edited, setEdited] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluateResponse | null>(null);
  const [easy, setEasy] = useState(false);
  const [error, setError] = useState<DescribedError | null>(null);
  const [stats, setStats] = useState({ rated: 0, activated: 0 });
  const [quotaStop, setQuotaStop] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const now = new Date();
      const limit = await getSetting<number>('dailyReviewLimit', DEFAULT_DAILY_LIMIT);
      const left = limit - (await reviewedTodayCount(now));
      const [g, next] = await Promise.all([getDueGroups(now, left), nextDueAt()]);
      if (alive) {
        setGroups(g);
        setNextDue(next);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const group = groups[idx];
  const listening = speech.state === 'listening';
  const shownAnswer = edited ?? (listening ? `${speech.finalText} ${speech.interimText}`.trim() : speech.finalText);
  const answer = shownAnswer.trim();

  function resetTask() {
    setHint(0);
    setEdited(null);
    setEvaluation(null);
    setEasy(false);
    setError(null);
    speech.reset();
  }

  function advance() {
    resetTask();
    if (idx + 1 < groups.length) {
      setIdx(idx + 1);
      setPhase('task');
    } else {
      setPhase('done');
    }
  }

  async function check() {
    if (!group) return;
    setPhase('checking');
    setError(null);
    try {
      const result = await evaluate({
        kind: 'rephrase',
        sentence: group.utterance.transcript,
        targets: group.items.map(({ id, original, replacement, lemma, pattern }) => ({ id, original, replacement, lemma, pattern })),
        answer,
        topic: null,
      });
      setEvaluation(result);
      setPhase('result');
    } catch (e) {
      if (e instanceof AiError && e.code === 'QUOTA') {
        setQuotaStop(true);
        setPhase('done');
        return;
      }
      setError(describeAiError(e));
      setPhase('task');
    }
  }

  const ctxFor = (e: EvaluateResponse) => ({
    hintUsed: hint > 0,
    meaningPreserved: e.meaning_preserved,
    naturalness: e.naturalness,
  });
  const allGood =
    evaluation !== null &&
    evaluation.targets.every((t) => rateTarget(t, { ...ctxFor(evaluation), easyTapped: false }) === 3);

  async function next() {
    if (!group || !evaluation) return;
    const res = await applyReview({
      utteranceId: group.utterance.id,
      items: group.items,
      kind: 'rephrase',
      answerTranscript: answer,
      hintUsed: hint > 0,
      evaluation,
      easyTapped: easy && allGood,
    });
    setStats((s) => ({
      rated: s.rated + group.items.length,
      activated: s.activated + res.activatedItemIds.length,
    }));
    advance();
  }

  async function listen(text: string) {
    speakGerman(text, {
      voiceURI: await getSetting<string>('ttsVoice', ''),
      rate: await getSetting<number>('ttsRate', 0.95),
    });
  }

  if (loading) return <section className="page"><h1>{ruReview.title}</h1></section>;

  // ---------- start ----------
  if (phase === 'start') {
    return (
      <section className="page">
        <h1>{ruReview.title}</h1>
        {groups.length === 0 ? (
          <EmptyState
            emoji={nextDue !== null ? '🌿' : '🌱'}
            title={ruReview.nothingDue}
            text={nextDue !== null ? ruReview.nextReview(fmtDate(nextDue)) : ruUi.emptyReviewText}
            to="/speak"
            cta={ruUi.goSpeak}
          />
        ) : (
          <>
            <p className="card">
              {ruReview.summary(groups.reduce((n, g) => n + g.items.length, 0), groups.length)}
            </p>
            <button type="button" className="btn primary block" onClick={() => setPhase('task')}>
              {ruReview.start}
            </button>
          </>
        )}
      </section>
    );
  }

  // ---------- done ----------
  if (phase === 'done' || !group) {
    return (
      <section className="page">
        <h1>{ruReview.doneTitle}</h1>
        {quotaStop && <p className="card" role="status">{ruReview.quotaStop}</p>}
        {(stats.rated > 0 || !quotaStop) && (
          <p className="card" role="status">{ruReview.done(stats.rated, stats.activated)}</p>
        )}
        <button type="button" className="btn primary block" onClick={() => navigate('/speak')}>
          {ruReview.home}
        </button>
      </section>
    );
  }

  // ---------- task / checking / result ----------
  const { segments, missing } = highlight(group.utterance.transcript, group.items.map((i) => i.original));
  const busy = phase === 'checking';

  return (
    <section className="page">
      <h1>{ruReview.title}</h1>
      <p className="muted small">{ruReview.progress(idx + 1, groups.length)}</p>

      <p className="card" lang="de">
        {segments.map((s, i) => (s.mark ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
      </p>
      <p>
        {ruReview.task}{' '}
        {group.items.map((i, k) => (
          <span key={i.id}>{k > 0 && ', '}<strong>{i.original}</strong></span>
        ))}
      </p>
      {missing.length > 0 && <p className="muted small">{ruReview.without}: {missing.join(', ')}</p>}

      {phase !== 'result' && (
        <>
          {hint >= 1 && (
            <ul className="small">
              {group.items.map((i) => (
                <li key={i.id}>
                  {ruReview.hintLabelMeaning}: {i.meaningRu}
                  {hint >= 2 && <> · {ruReview.hintLabelStart}: {i.replacement.slice(0, 3)}…</>}
                </li>
              ))}
            </ul>
          )}
          {hint < 2 && (
            <button type="button" className="btn" disabled={busy} onClick={() => setHint(hint + 1)}>
              {ruReview.hint}
            </button>
          )}

          <RecordButton
            supported={speech.supported}
            state={speech.state}
            seconds={speech.seconds}
            error={speech.error}
            disabled={busy}
            onStart={() => { setEdited(null); speech.start(); }}
            onStop={speech.stop}
          />
          {!speech.supported && <p className="muted small">{ruSpeech.unsupported}</p>}

          <div className="field">
            <label htmlFor="answer">{ruReview.answerLabel}</label>
            <textarea
              id="answer"
              lang="de"
              value={shownAnswer}
              placeholder={ruReview.answerPlaceholder}
              disabled={busy || listening}
              onChange={(e) => setEdited(e.target.value)}
            />
          </div>

          {error && <ErrorNotice error={error} onRetry={check} />}

          <div className="row">
            <button type="button" className="btn primary" disabled={!answer || busy || listening} onClick={check}>
              {busy ? ruReview.checking : ruReview.check}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={advance}>{ruReview.skip}</button>
          </div>
        </>
      )}

      {phase === 'result' && evaluation && (
        <>
          <p className="card" lang="de">{answer}</p>
          <ul className="card">
            {group.items.map((item) => {
              const t = evaluation.targets.find((x) => x.id === item.id);
              const ok = !!t && t.used && t.correct;
              return (
                <li key={item.id}>
                  <span className={ok ? '' : 'error'}>{ok ? '✓' : '✗'}</span> <strong>{item.replacement}</strong>
                  {t?.comment_ru && <> — <span className="muted">{t.comment_ru}</span></>}
                </li>
              );
            })}
          </ul>
          {evaluation.errors.length > 0 && (
            <ul className="small">
              {evaluation.errors.map((e, i) => (
                <li key={i}>
                  <del>{e.fragment}</del> → <strong>{e.correction}</strong> — <span className="muted">{e.explanation_ru}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="card">
            <h2>{ruReview.better}</h2>
            <p lang="de">{evaluation.better_version}</p>
            <button type="button" className="btn" onClick={() => listen(evaluation.better_version)}>🔊</button>
          </div>
          <p>{evaluation.feedback_ru}</p>
          {allGood && (
            <label className="row">
              <input type="checkbox" checked={easy} onChange={(e) => setEasy(e.target.checked)} />
              {ruReview.easy}
            </label>
          )}
          <button type="button" className="btn primary block" onClick={next}>{ruReview.next}</button>
        </>
      )}
    </section>
  );
}
