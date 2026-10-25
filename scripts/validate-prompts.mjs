// Phase 0: run Lena's real phrases through prompts/analyze.md on the Gemini API
// and write a report that is easy to read and grade on a phone.
//
// Usage:
//   npm run validate                      all phrases, model from .env.local
//   npm run validate -- --limit=3         first 3 phrases only
//   npm run validate -- --model=NAME      override GEMINI_MODEL
//   npm run validate -- --delay=13        seconds between requests

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Ajv from 'ajv';
import { toProviderSchema } from './lib/schema-utils.mjs';
import { loadEnvFile } from './lib/env.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = (...p) => join(ROOT, ...p);
const CONTEXTS = new Set(['work', 'daily', 'office', 'free']);
const REGISTER = { colloquial: 'разг.', neutral: 'нейтр.', formal: 'офиц.' };
const API_BASE = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';

// ---------- args & config ----------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), 'true'];
  }),
);

loadEnvFile(path('.env.local'));
const apiKey = process.env.GEMINI_API_KEY;
const model = args.model || process.env.GEMINI_MODEL;
const limit = args.limit ? Number(args.limit) : Infinity;
const delaySec = args.delay !== undefined ? Number(args.delay) : 13;

if (!apiKey) fail('Нет GEMINI_API_KEY. Создай файл .env.local по образцу .env.example.');
if (!model) fail('Не указана модель: GEMINI_MODEL в .env.local или флаг --model=ИМЯ.');

// ---------- inputs ----------
const prompt = readFileSync(path('prompts', 'analyze.md'), 'utf8');
const schemaFull = JSON.parse(readFileSync(path('schemas', 'analyze.schema.json'), 'utf8'));
const schemaForApi = toProviderSchema(schemaFull);
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schemaFull);

const phrasesFile = existsSync(path('validation', 'phrases.txt'))
  ? path('validation', 'phrases.txt')
  : path('validation', 'phrases.example.txt');
const phrases = parsePhrases(readFileSync(phrasesFile, 'utf8')).slice(0, limit);
if (phrases.length === 0) fail(`В файле ${phrasesFile} нет фраз.`);

console.log(`Фраз: ${phrases.length} · модель: ${model} · файл: ${phrasesFile.replace(ROOT, '.')}`);

// ---------- run ----------
const results = [];
let stoppedByQuota = false;

for (let i = 0; i < phrases.length; i++) {
  const { context, transcript } = phrases[i];
  process.stdout.write(`[${i + 1}/${phrases.length}] ${transcript.slice(0, 60)}… `);
  try {
    const output = await analyze({ transcript, context });
    const schemaErrors = validate(output) ? [] : validate.errors.map((e) => `${e.instancePath || '/'} ${e.message}`);
    const missingSpans = (output.suggestions || [])
      .map((s) => s.original)
      .filter((o) => typeof o === 'string' && !transcript.includes(o));
    results.push({ context, transcript, output, schemaErrors, missingSpans });
    console.log(schemaErrors.length ? '⚠ схема' : 'ok');
  } catch (err) {
    if (err.code === 'QUOTA') {
      console.log('лимит');
      stoppedByQuota = true;
      results.push({ context, transcript, error: 'Дневной лимит исчерпан — фраза не проверена.' });
      break;
    }
    console.log(`ошибка: ${err.message}`);
    results.push({ context, transcript, error: err.message });
  }
  if (i < phrases.length - 1) await sleep(delaySec * 1000);
}

// ---------- write ----------
const generatedAt = new Date().toISOString();
writeFileSync(
  path('validation', 'report.json'),
  JSON.stringify({ model, generatedAt, stoppedByQuota, results }, null, 2),
);
writeFileSync(path('validation', 'report.md'), renderReport({ model, generatedAt, stoppedByQuota, results }));
console.log('\nГотово: validation/report.md (и report.json)');

// ---------- helpers ----------
function parsePhrases(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const bar = l.indexOf('|');
      if (bar === -1) return { context: 'free', transcript: l };
      const ctx = l.slice(0, bar).trim().toLowerCase();
      const transcript = l.slice(bar + 1).trim();
      return { context: CONTEXTS.has(ctx) ? ctx : 'free', transcript };
    })
    .filter((p) => p.transcript);
}

async function analyze(input) {
  const body = {
    systemInstruction: { parts: [{ text: prompt }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: schemaForApi,
    },
  };
  const res = await fetch(`${API_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });

  if (res.status === 429) throw Object.assign(new Error('429'), { code: 'QUOTA' });
  if (!res.ok) {
    // Show only Google's short message, never the request (it contains the key header).
    let message = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error?.message) message += `: ${j.error.message}`;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  const data = await res.json();
  if (data.promptFeedback?.blockReason) throw new Error(`заблокировано: ${data.promptFeedback.blockReason}`);
  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error('пустой ответ');
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`ответ оборван: ${candidate.finishReason}`);
  }
  const text = (candidate.content?.parts || []).map((p) => p.text || '').join('');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('ответ не JSON');
  }
}

function renderReport({ model, generatedAt, stoppedByQuota, results }) {
  const lines = [
    '# Отчёт фазы 0',
    '',
    `Модель: **${model}** · ${generatedAt.slice(0, 16).replace('T', ' ')} UTC · фраз: ${results.length}`,
    '',
    'Отметь каждую замену: ✅ взяла бы · 🤔 не уверена · ❌ странно/неверно.',
    '',
  ];
  if (stoppedByQuota) lines.push('> ⚠ Дневной бесплатный лимит исчерпан — прогон остановлен. Остальные фразы — завтра.', '');

  results.forEach((r, i) => {
    lines.push(`## ${i + 1}. ${r.context} — ${r.transcript}`, '');
    if (r.error) {
      lines.push(`**Ошибка:** ${r.error}`, '');
      return;
    }
    const o = r.output;
    if (o.is_german === false) lines.push('_Модель решила, что это не немецкая фраза._', '');
    lines.push(`**Исправлено:** ${o.corrected_sentence ? o.corrected_sentence : '—'}`);
    for (const g of o.grammar_notes || []) {
      lines.push(`- ${g.original} → ${g.correction} — ${g.explanation_ru}`);
    }
    lines.push(`**Улучшено:** ${o.improved_sentence}`, '');

    if ((o.suggestions || []).length === 0) lines.push('_Замен нет._', '');
    for (const s of o.suggestions || []) {
      const warn = r.missingSpans.includes(s.original) ? ' ⚠ original не найден' : '';
      lines.push(
        `- [ ] ✅ / 🤔 / ❌  **${s.original} → ${s.replacement}** (${s.lemma} · ${s.pattern} · ${REGISTER[s.register] || s.register})${warn}`,
        `  ${s.meaning_ru} — ${s.note_ru}`,
        `  _${s.example_de}_`,
      );
    }
    lines.push('');
    const keep = (o.keep || []).map((k) => `${k.word} (${k.reason_ru})`).join('; ') || '—';
    const generic = (o.generic_words || []).join(', ') || '—';
    lines.push(`Оставить: ${keep}  ·  Слабые слова: ${generic}`, '');
    if (r.schemaErrors.length) lines.push(`> ⚠ Ответ не прошёл схему: ${r.schemaErrors.join('; ')}`, '');
  });

  lines.push('---', '', '**Не хватило замен в фразах №:** ', '', '**Модель исправила правильное в фразах №:** ', '');
  return lines.join('\n');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}
