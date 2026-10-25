import { useEffect, useState } from 'react';
import questionData from '../../data/questions.json';
import { analyze } from '../ai/client';
import type { AnalyzeResponse, Suggestion } from '../ai/contracts.generated';
import { BackupBanner } from '../components/BackupBanner';
import { ErrorNotice } from '../components/ErrorNotice';
import { RecordButton } from '../components/RecordButton';
import { getSetting, saveUtterance, setSetting } from '../db/repo';
import type { Context } from '../db/types';
import { describeAiError, type DescribedError } from '../features/aiErrorText';
import { AnalysisView } from '../features/speak/AnalysisView';
import { speakGerman } from '../features/speech/tts';
import { useSpeechRecognition } from '../features/speech/useSpeechRecognition';
import { analyzeExamples } from '../features/speak/fixtures';
import { ruContext, ruSpeak, ruUi } from '../i18n/ru';

interface Question { id: string; context: string; text: string }
const QUESTIONS = questionData as Question[];
const CONTEXTS: Context[] = ['work', 'daily', 'office', 'free'];

function pickQuestion(context: Context, excludeId?: string): Question | null {
  const pool = QUESTIONS.filter((q) => q.context === context && q.id !== excludeId);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

export function SpeakPage() {
  const speech = useSpeechRecognition();
  const [context, setContext] = useState<Context>('work');
  const [useQuestion, setUseQuestion] = useState(true);
  const [question, setQuestion] = useState<Question | null>(() => pickQuestion('work'));
  const [edited, setEdited] = useState<string | null>(null);
  const [phase, setPhase] = useState<'input' | 'busy' | 'result'>('input');
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<DescribedError | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let alive = true;
    getSetting<Context>('lastContext', 'work').then((c) => {
      if (alive && CONTEXTS.includes(c)) {
        setContext(c);
        setQuestion(pickQuestion(c));
      }
    });
    return () => { alive = false; };
  }, []);

  const listening = speech.state === 'listening';
  const shownText = edited ?? (listening ? `${speech.finalText} ${speech.interimText}`.trim() : speech.finalText);
  const text = shownText.trim();

  function chooseContext(c: Context) {
    setContext(c);
    setQuestion(pickQuestion(c));
    void setSetting('lastContext', c);
  }

  function startRecording() {
    setEdited(null);
    setSavedMsg(null);
    speech.start();
  }

  async function runAnalyze() {
    setPhase('busy');
    setError(null);
    setSavedMsg(null);
    try {
      setAnalysis(await analyze({ transcript: text, context }));
      setPhase('result');
    } catch (e) {
      setError(describeAiError(e));
      setPhase('input');
    }
  }

  function showDemo() {
    const ex = analyzeExamples[0];
    setEdited(ex.input.transcript);
    setAnalysis(ex.output);
    setDemo(true);
    setPhase('result');
  }

  async function save(selected: Suggestion[]) {
    if (!analysis) return;
    if (demo) {
      setSavedMsg(ruUi.demoNote);
      newPhrase();
      return;
    }
    setSaving(true);
    try {
      await saveUtterance(
        {
          context,
          question: useQuestion && question ? question.text : null,
          rawTranscript: speech.finalText,
          transcript: text,
          analysis,
        },
        selected,
      );
      setSavedMsg(ruSpeak.saved(selected.length));
      newPhrase();
    } finally {
      setSaving(false);
    }
  }

  function newPhrase() {
    speech.reset();
    setEdited(null);
    setAnalysis(null);
    setDemo(false);
    setPhase('input');
    setQuestion(pickQuestion(context, question?.id));
  }

  async function listen(t: string) {
    speakGerman(t, {
      voiceURI: await getSetting<string>('ttsVoice', ''),
      rate: await getSetting<number>('ttsRate', 0.95),
    });
  }

  const showQuestion = useQuestion && question && context !== 'free';

  return (
    <section className="page">
      <h1>{ruSpeak.title}</h1>
      <BackupBanner />

      <div className="chips" role="group">
        {CONTEXTS.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={context === c} onClick={() => chooseContext(c)}>
            {ruContext[c]}
          </button>
        ))}
      </div>

      {savedMsg && <p className="card" role="status">{savedMsg}</p>}

      {phase !== 'result' && (
        <>
          {context !== 'free' && (
            <div>
              {showQuestion && <p className="question">{question.text}</p>}
              <div className="row">
                {showQuestion && (
                  <button type="button" className="btn" onClick={() => setQuestion(pickQuestion(context, question.id))}>
                    {ruSpeak.anotherQuestion}
                  </button>
                )}
                <button type="button" className="btn" onClick={() => setUseQuestion((v) => !v)}>
                  {useQuestion ? ruSpeak.noQuestion : ruSpeak.withQuestion}
                </button>
              </div>
            </div>
          )}

          <RecordButton
            supported={speech.supported}
            state={speech.state}
            seconds={speech.seconds}
            error={speech.error}
            disabled={phase === 'busy'}
            onStart={startRecording}
            onStop={speech.stop}
          />

          <div className="field">
            <label htmlFor="phrase">{ruSpeak.textLabel}</label>
            <textarea
              id="phrase"
              lang="de"
              value={shownText}
              placeholder={ruSpeak.textPlaceholder}
              disabled={phase === 'busy' || listening}
              onChange={(e) => setEdited(e.target.value)}
            />
            <p className="muted small">{ruSpeak.privacy}</p>
          </div>

          {error && <ErrorNotice error={error} onRetry={runAnalyze} />}

          <button
            type="button"
            className="btn primary block"
            disabled={!text || phase === 'busy' || listening}
            onClick={runAnalyze}
          >
            {phase === 'busy' ? ruSpeak.analyzing : ruSpeak.analyze}
          </button>
          <button type="button" className="btn ghost block" onClick={showDemo}>{ruUi.demo}</button>
        </>
      )}

      {phase === 'result' && analysis && (
        <>
          <p className="card" lang="de">{text}</p>
          <AnalysisView analysis={analysis} saving={saving} onSave={save} onSpeak={listen} />
          <button type="button" className="btn block" onClick={newPhrase}>{ruSpeak.again}</button>
        </>
      )}
    </section>
  );
}
