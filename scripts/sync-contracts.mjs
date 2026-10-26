// prompts/*.md + schemas/*.json  ->  src/ai/contracts.generated.ts
// Run via `npm run sync` (also before build and test).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compile } from 'json-schema-to-typescript';
import { toProviderSchema } from './lib/schema-utils.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

const analyzeSchema = JSON.parse(read('schemas', 'analyze.schema.json'));
const evaluateSchema = JSON.parse(read('schemas', 'evaluate.schema.json'));
const cardsSchema = JSON.parse(read('schemas', 'cards.schema.json'));

const opts = { bannerComment: '', additionalProperties: false, format: false, strictIndexSignatures: false };
const types = [
  await compile(analyzeSchema, 'AnalyzeResponse', { ...opts, declareExternallyReferenced: true }),
  await compile(evaluateSchema, 'EvaluateResponse', { ...opts, declareExternallyReferenced: true }),
  await compile(cardsSchema, 'CardsResponse', { ...opts, declareExternallyReferenced: true }),
].join('\n');

const lit = (v) => JSON.stringify(v, null, 2);
const out = `// СГЕНЕРИРОВАНО scripts/sync-contracts.mjs — не редактировать
/* eslint-disable */

${types}
export const ANALYZE_PROMPT = ${JSON.stringify(read('prompts', 'analyze.md'))};

export const EVALUATE_PROMPT = ${JSON.stringify(read('prompts', 'evaluate.md'))};

export const CARDS_PROMPT = ${JSON.stringify(read('prompts', 'cards.md'))};

export const ANALYZE_SCHEMA = ${lit(toProviderSchema(analyzeSchema))} as const;

export const EVALUATE_SCHEMA = ${lit(toProviderSchema(evaluateSchema))} as const;

export const CARDS_SCHEMA = ${lit(toProviderSchema(cardsSchema))} as const;

export const ANALYZE_SCHEMA_FULL = ${lit(analyzeSchema)} as const;

export const EVALUATE_SCHEMA_FULL = ${lit(evaluateSchema)} as const;

export const CARDS_SCHEMA_FULL = ${lit(cardsSchema)} as const;
`;
writeFileSync(join(ROOT, 'src', 'ai', 'contracts.generated.ts'), out);
console.log('sync: src/ai/contracts.generated.ts');
