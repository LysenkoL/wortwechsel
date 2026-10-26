import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { diagnose, type DiagnosisStep } from '../ai/client';
import { DEFAULT_ANALYZE_MODEL, DEFAULT_EVALUATE_MODEL } from '../ai/defaults';
import { exportAll, getUsage, importAll, makeAllDueNow, setSetting } from '../db/repo';
import { describeAiError } from '../features/aiErrorText';
import { DEFAULT_DAILY_LIMIT } from '../features/review/useDueCount';
import { germanVoices, speakGerman } from '../features/speech/tts';
import { useSetting } from '../features/useSetting';
import { ruSettings as t } from '../i18n/ru';
import { localDay } from '../srs/scheduler';

const LIMITS = [10, 20, 30, 50];

function ApiKeySection() {
  const [saved, setSaved] = useSetting<string>('apiKey', '');
  const [draft, setDraft] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<DiagnosisStep[]>([]);
  const value = draft ?? saved;

  async function save() {
    await setSaved(value.trim());
    setDraft(null);
    setStatus({ ok: true, text: t.keySaved });
  }

  async function test() {
    setBusy(true);
    setStatus(null);
    try {
      await setSaved(value.trim());
      setDraft(null);
      setSteps([]);
      const result = await diagnose();
      setSteps(result);
      if (result.every((r) => r.ok)) setStatus({ ok: true, text: t.keyWorks });
    } catch (e) {
      const d = describeAiError(e);
      setStatus({ ok: false, text: d.detail ? `${d.text} (${d.detail})` : d.text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>{t.key}</h2>
      <div className="field">
        <input
          type={visible ? 'text' : 'password'}
          aria-label={t.key}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>
      <div className="row">
        <button type="button" className="btn" onClick={() => setVisible((v) => !v)}>{visible ? t.hide : t.show}</button>
        <button type="button" className="btn" onClick={save}>{t.saveKey}</button>
        <button type="button" className="btn primary" disabled={busy || !value.trim()} onClick={test}>
          {busy ? t.testing : t.test}
        </button>
      </div>
      {steps.length > 0 && (
        <ul className="small diag">
          {steps.map((st) => (
            <li key={st.label}>
              {st.ok ? '✅' : '❌'} {t.stepLabels[st.label] ?? st.label}
              {st.ms > 0 && <span className="muted"> · {(st.ms / 1000).toFixed(1)} с</span>}
              {st.detail && <div className="muted">{st.detail}</div>}
            </li>
          ))}
        </ul>
      )}
      {status && <p role="status" className={status.ok ? '' : 'error'}>{status.text}</p>}
      <details>
        <summary>{t.howToKey}</summary>
        <ol className="small">{t.howToKeySteps.map((s) => <li key={s}>{s}</li>)}</ol>
      </details>
    </section>
  );
}

function ModelsSection() {
  const [analyzeModel, setAnalyzeModel] = useSetting<string>('analyzeModel', '');
  const [evaluateModel, setEvaluateModel] = useSetting<string>('evaluateModel', '');
  return (
    <section className="card">
      <h2>{t.models}</h2>
      {[
        { label: t.analyzeModel, value: analyzeModel, set: setAnalyzeModel, def: DEFAULT_ANALYZE_MODEL },
        { label: t.evaluateModel, value: evaluateModel, set: setEvaluateModel, def: DEFAULT_EVALUATE_MODEL },
      ].map((m) => (
        <div className="field" key={m.label}>
          <label htmlFor={m.label}>{m.label}</label>
          <input id={m.label} type="text" spellCheck={false} placeholder={m.def} value={m.value} onChange={(e) => m.set(e.target.value)} />
          {m.value && <button type="button" className="btn" onClick={() => m.set('')}>{t.byDefault}</button>}
        </div>
      ))}
    </section>
  );
}

function VoiceSection() {
  const [voiceURI, setVoiceURI] = useSetting<string>('ttsVoice', '');
  const [rate, setRate] = useSetting<number>('ttsRate', 0.95);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => germanVoices());

  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
    const update = () => setVoices(germanVoices());
    speechSynthesis.addEventListener('voiceschanged', update);
    return () => speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);

  return (
    <section className="card">
      <h2>{t.voice}</h2>
      <div className="field">
        <select aria-label={t.voice} value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)}>
          <option value="">{t.voiceAuto}</option>
          {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="rate">{t.rate}: {rate.toFixed(2)}</label>
        <input id="rate" type="range" min={0.8} max={1.1} step={0.05} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
      </div>
      <button type="button" className="btn" onClick={() => speakGerman(t.sampleText, { voiceURI, rate })}>🔊 {t.listen}</button>
    </section>
  );
}

function BackupSection() {
  const [restoreFile, setRestoreFile] = useState<unknown>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function download() {
    const file = await exportAll();
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wortwechsel-backup-${localDay(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    await setSetting('lastExportAt', Date.now());
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      setRestoreFile(JSON.parse(await file.text()));
      setMessage(null);
    } catch {
      setRestoreFile(null);
      setMessage({ ok: false, text: 'Не удалось прочитать файл.' });
    }
  }

  async function restore(mode: 'replace' | 'merge') {
    try {
      const r = await importAll(restoreFile, mode);
      setMessage({ ok: true, text: t.restored(r.utterances, r.items) });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Ошибка импорта.' });
    } finally {
      setRestoreFile(null);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <section className="card">
      <h2>{t.backup}</h2>
      <div className="row">
        <button type="button" className="btn" onClick={download}>{t.download}</button>
        <button type="button" className="btn" onClick={() => input.current?.click()}>{t.restore}</button>
        <input ref={input} type="file" accept="application/json,.json" hidden aria-label={t.restore} onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {restoreFile !== null && (
        <div>
          <p className="small">{t.restoreHint}</p>
          <div className="row">
            <button type="button" className="btn danger" onClick={() => restore('replace')}>{t.replaceAll}</button>
            <button type="button" className="btn" onClick={() => restore('merge')}>{t.merge}</button>
          </div>
        </div>
      )}
      {message && <p role="status" className={message.ok ? '' : 'error'}>{message.text}</p>}
    </section>
  );
}

function UsageSection() {
  const now = new Date();
  const today = localDay(now);
  const monthStart = `${today.slice(0, 8)}01`;
  const rows = useLiveQuery(() => getUsage(monthStart, today), [monthStart, today]) ?? [];
  const sum = (kind: 'analyze' | 'evaluate', only?: string) =>
    rows.filter((r) => !only || r.day === only).reduce((n, r) => n + r[kind], 0);
  return (
    <section className="card">
      <h2>{t.usage}</h2>
      <p>{t.usageToday(sum('analyze', today), sum('evaluate', today))}</p>
      <p>{t.usageMonth(sum('analyze'), sum('evaluate'))}</p>
      <p className="muted small">{t.usageNote}</p>
    </section>
  );
}

/** Drops the cached app (service worker + caches) and loads the newest version. Data in IndexedDB stays. */
async function hardReload() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = (await caches?.keys()) ?? [];
    await Promise.all(keys.map((k) => caches.delete(k)));
  } finally {
    window.location.reload();
  }
}

export function SettingsPage() {
  const [limit, setLimit] = useSetting<number>('dailyReviewLimit', DEFAULT_DAILY_LIMIT);
  const [debugMsg, setDebugMsg] = useState(false);
  const debug = new URLSearchParams(window.location.search).get('debug') === '1';

  return (
    <section className="page">
      <h1>{t.title}</h1>
      <ApiKeySection />
      <ModelsSection />
      <section className="card">
        <h2>{t.dailyLimit}</h2>
        <select aria-label={t.dailyLimit} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          {LIMITS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </section>
      <VoiceSection />
      <BackupSection />
      <UsageSection />
      <section className="card">
        <p className="small muted">{t.version}: {__BUILD_TIME__.slice(0, 16).replace('T', ' ')} UTC</p>
        <button type="button" className="btn" onClick={hardReload}>{t.updateApp}</button>
      </section>
      {debug && (
        <section className="card">
          <h2>{t.debug}</h2>
          <button type="button" className="btn" onClick={async () => { await makeAllDueNow(); setDebugMsg(true); }}>{t.makeDue}</button>
          {debugMsg && <p role="status">{t.madeDue}</p>}
        </section>
      )}
    </section>
  );
}
