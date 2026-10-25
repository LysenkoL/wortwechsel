# Архитектура

> Владелец документа: Claude (архитектор). Исполнитель (GPT/Codex) этот файл
> **не меняет** — если что-то мешает, пишет в раздел «Вопросы» в `STATUS.md`.
> Причины решений — в `docs/decisions.md`.

## 1. Общая схема

```
┌──────── Телефон / браузер — PWA с GitHub Pages ────────────────────┐
│                                                                    │
│  Микрофон ─▶ распознавание речи браузера (Web Speech API, de-DE)   │
│                     │ текст (можно поправить)                      │
│                     ▼                                              │
│  React + TypeScript ─▶ src/ai/ ──── HTTPS + ключ ────▶ Gemini API  │
│                     │                                  (бесплатный │
│                     ▼                                    тариф)    │
│  IndexedDB (Dexie): фразы, выражения + FSRS, повторения,           │
│                     настройки (в т.ч. ключ API)                    │
└────────────────────────────────────────────────────────────────────┘
```

**Своего сервера нет.** Приложение — статические файлы на GitHub Pages.
Ключ Gemini API Лена вводит в настройках; он хранится только в IndexedDB
на её устройстве и уходит только в Google. Все данные — на устройстве.

## 2. Стек

| Слой | Выбор |
|---|---|
| Сборка | Vite, TypeScript `strict: true` |
| UI | React, React Router (`HashRouter` — для GitHub Pages), CSS Modules + `src/styles/tokens.css` |
| PWA | `vite-plugin-pwa` (manifest, service worker, офлайн-оболочка) |
| Хранилище | Dexie (IndexedDB) + `dexie-react-hooks` |
| Интервальное повторение | `ts-fsrs` |
| Распознавание речи | Web Speech API браузера (`SpeechRecognition`, `lang: 'de-DE'`) |
| Озвучка | `window.speechSynthesis`, голос `de-DE` |
| AI | Gemini API, `generateContent` со структурированным выводом по JSON-схеме |
| Проверка ответов AI | `ajv` в браузере |
| Хостинг | GitHub Pages, сборка и публикация через GitHub Actions |
| Тесты | Vitest, `@testing-library/react`, `fake-indexeddb` |
| Контракты | `json-schema-to-typescript` (генерация типов из `schemas/`) |

Версии пакетов — актуальные на момент реализации. Названия моделей
**не хардкодятся** в логике: значения по умолчанию лежат в одном файле
`src/ai/defaults.ts` и меняются в настройках приложения (см. §7).

## 3. Структура репозитория

```
wortwechsel/
├─ AGENTS.md  CLAUDE.md  README.md  STATUS.md
├─ .github/workflows/deploy.yml   сборка и публикация на GitHub Pages
├─ docs/        vision, architecture, decisions, workflow
├─ tasks/       тикеты T00…; tasks/README.md — доска
├─ prompts/     ИСТОЧНИК ИСТИНЫ: системные промпты (меняет только Claude)
├─ schemas/     ИСТОЧНИК ИСТИНЫ: JSON-схемы ответов AI (меняет только Claude)
├─ data/        questions.json — вопросы-подсказки
├─ validation/  фаза 0: свои фразы (не коммитятся!) и чек-лист
├─ scripts/
│  ├─ lib/schema-utils.mjs  подготовка схемы для провайдера
│  ├─ sync-contracts.mjs    prompts + schemas → сгенерированный TS
│  └─ validate-prompts.mjs  фаза 0 (тикет T00)
└─ src/
   ├─ main.tsx  App.tsx
   ├─ routes/      SpeakPage, ReviewPage, ExpressionsPage, SettingsPage
   ├─ features/    speech/, speak/, review/, expressions/
   ├─ components/  общие UI-компоненты
   ├─ db/          db.ts (схема Dexie), repo.ts (все запросы к БД)
   ├─ srs/         scheduler.ts, rating.ts  (чистые функции, 100% тестов)
   ├─ ai/          ЕДИНСТВЕННОЕ место с сетевыми запросами
   │  ├─ client.ts          analyze(), evaluate() для экранов
   │  ├─ gemini.ts          вызов Gemini API
   │  ├─ postprocess.ts     проверка ajv, обрезка массивов, проверка id
   │  ├─ errors.ts          AiError
   │  ├─ defaults.ts        модели по умолчанию
   │  └─ contracts.generated.ts   ← генерируется, руками не править
   ├─ i18n/        ru.ts (все тексты интерфейса)
   └─ styles/      tokens.css, global.css
```

**Правило генерации.** `npm run sync` (запускается и в `prebuild`, и в
`pretest`) читает `prompts/analyze.md`, `prompts/evaluate.md` и
`schemas/*.json` и пишет `src/ai/contracts.generated.ts`:
- TS-типы `AnalyzeResponse`, `EvaluateResponse` и вложенные;
- `ANALYZE_PROMPT`, `EVALUATE_PROMPT` — строки промптов;
- `ANALYZE_SCHEMA`, `EVALUATE_SCHEMA` — схемы после `toProviderSchema()`
  (убраны `title` и `$schema` на всех уровнях).

Так промпт и схема меняются в одном месте, а код получает их автоматически.

## 4. Модель данных (Dexie, база `wortwechsel`, версия 1)

```ts
type Context  = 'work' | 'daily' | 'office' | 'free'; // office = Behörde/Amt
type Register = 'colloquial' | 'neutral' | 'formal';
type Stage    = 'learning' | 'active' | 'suspended';

interface Utterance {
  id: string;              // crypto.randomUUID()
  createdAt: number;       // epoch ms
  context: Context;
  question: string | null; // если отвечала на вопрос-подсказку
  rawTranscript: string;   // как вернуло распознавание ('' если вводила текстом)
  transcript: string;      // после правки Леной (это и анализировалось)
  analysis: AnalyzeResponse;
}

interface Item {           // одна сохранённая замена = одна карточка FSRS
  id: string;
  utteranceId: string;
  createdAt: number;
  original: string;        // "gesagt" — подстрока её фразы
  replacement: string;     // "klargemacht" — форма для этой фразы
  lemma: string;           // "klarmachen"
  pattern: string;         // "jdm. klarmachen, dass …"
  meaningRu: string;
  noteRu: string;
  register: Register;
  exampleDe: string;
  card: SerializedCard;    // карточка ts-fsrs, даты → epoch ms
  due: number;             // = card.due, вынесено для индекса
  correctDays: string[];   // 'YYYY-MM-DD' дни с правильным употреблением
  stage: Stage;
}

interface Review {
  id: string;
  utteranceId: string;
  itemIds: string[];
  kind: 'rephrase' | 'transfer';
  reviewedAt: number;
  answerTranscript: string;
  hintUsed: boolean;
  evaluation: EvaluateResponse;
  ratings: Record<string, 1 | 2 | 3 | 4>; // itemId → Rating FSRS
}

interface UsageDay { day: string; analyze: number; evaluate: number; } // day = 'YYYY-MM-DD'
interface Setting  { key: string; value: unknown; }
```

Ключи настроек: `apiKey`, `analyzeModel`, `evaluateModel`,
`dailyReviewLimit`, `ttsVoice`, `ttsRate`, `lastContext`, `lastExportAt`.

Индексы Dexie:

```ts
db.version(1).stores({
  utterances: 'id, createdAt, context',
  items:      'id, utteranceId, due, stage, lemma',
  reviews:    'id, reviewedAt, utteranceId',
  usage:      'day',
  settings:   'key',
});
```

Все обращения к БД — только через `src/db/repo.ts`. Компоненты Dexie напрямую
не трогают.

## 5. Интервальное повторение (src/srs)

**Параметры ts-fsrs:** `request_retention: 0.9`, `maximum_interval: 180`,
`enable_fuzz: true`, `enable_short_term: false` (ошибки возвращаются
на следующий день, а не через 10 минут — голосовое повторение тяжёлое).

**Сохранение замены:** `card = createEmptyCard()`, а `due` = завтра 04:00
по местному времени. Сам анализ фразы считается первым знакомством,
поэтому в тот же день карточка не показывается.

**Оценка — детерминированно в коде, не моделью.** AI возвращает факты
(употребила ли, правильно ли), а оценку ставит чистая функция
`rateTarget()` в `src/srs/rating.ts`:

| Условие (проверяется сверху вниз) | Rating |
|---|---|
| `used === false` | Again (1) |
| `used && !correct` | Hard (2) |
| была подсказка, или `meaning_preserved === false`, или `naturalness === 'unnatural'` | Hard (2) |
| иначе | Good (3) |
| Good + Лена нажала «Было легко» | Easy (4) |

После оценки: `scheduler.next(card, now, rating)` → новая карточка,
`item.due = card.due`. При Rating ≥ Good в `correctDays` добавляется
сегодняшняя дата (без дублей).

**Статус «активное»:** `correctDays.length >= 3`. В фазе 2 добавится
условие «хотя бы одно правильное употребление в задании transfer».

**Сессия повторения:** берутся items с `due <= now` и `stage !== 'suspended'`,
группируются по `utteranceId` (одна фраза = одно задание, даже если в ней
две замены), сортируются по самому раннему `due`. Лимит —
`dailyReviewLimit` items в день (по умолчанию 20, в настройках).

## 6. AI-слой (src/ai)

### Интерфейс для экранов (`client.ts`)

```ts
analyze(req: AnalyzeRequest): Promise<AnalyzeResponse>
evaluate(req: EvaluateRequest): Promise<EvaluateResponse>

interface AnalyzeRequest  { transcript: string; context: Context; }
interface EvaluateRequest {
  kind: 'rephrase' | 'transfer';
  sentence: string;                 // для transfer может быть ''
  targets: { id: string; original: string; replacement: string; lemma: string; pattern: string }[];
  answer: string;
  topic: string | null;             // только для transfer
}

class AiError extends Error {
  code: 'NO_KEY' | 'BAD_KEY' | 'QUOTA' | 'NETWORK' | 'TIMEOUT' | 'BLOCKED' | 'BAD_RESPONSE' | 'BAD_REQUEST';
}
```

`client.ts` берёт ключ и модель из настроек, проверяет вход
(`transcript` и `answer` 1–600 символов, `targets` 1–5, `context` из списка
— иначе `BAD_REQUEST` без запроса в сеть), вызывает `gemini.ts`, прогоняет
ответ через `postprocess.ts` и увеличивает счётчик в `usage`.

### Запрос к Gemini (`gemini.ts`)

`POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`,
заголовок `x-goog-api-key: <ключ>`, тело:

```json
{
  "systemInstruction": { "parts": [{ "text": "<ANALYZE_PROMPT>" }] },
  "contents": [{ "role": "user", "parts": [{ "text": "<JSON.stringify(запроса)>" }] }],
  "generationConfig": {
    "responseMimeType": "application/json",
    "responseJsonSchema": "<ANALYZE_SCHEMA>"
  }
}
```

Ответ: текст из `candidates[0].content.parts[*].text` → `JSON.parse`.
Имена полей и версию API (`v1beta`) **сверить с актуальной документацией
Gemini API** при реализации. `temperature` не задавать (для новых моделей
Google рекомендует значение по умолчанию). Можно взять официальный SDK
`@google/genai` вместо `fetch` — тогда он используется только внутри `gemini.ts`.

### Ошибки

| Ситуация | `AiError.code` |
|---|---|
| ключа нет в настройках | `NO_KEY` |
| 400 с причиной о ключе, 401, 403 | `BAD_KEY` |
| 429 | `QUOTA` |
| ответ заблокирован фильтрами (`promptFeedback.blockReason`, `finishReason` не `STOP`) | `BLOCKED` |
| не JSON или не проходит схему — **после одного автоматического повтора** | `BAD_RESPONSE` |
| сбой сети / нет интернета | `NETWORK` |
| дольше 30 с (`AbortController`) | `TIMEOUT` |

Ключ и полный ответ Google никогда не попадают в `console.log`.

### Постобработка (`postprocess.ts`)
- проверка `ajv` по исходной схеме;
- analyze: обрезка `suggestions` до 3, `keep` до 2, `grammar_notes` до 2;
- evaluate: каждый `id` из запроса ровно один раз, порядок — как в запросе;
  иначе `BAD_RESPONSE`.

## 7. Конфигурация

**В приложении (Настройки):**
- `apiKey` — ключ Gemini API;
- `analyzeModel` — модель для анализа фраз (качество важнее);
- `evaluateModel` — модель для проверки ответов (вызывается чаще).

Значения по умолчанию — в `src/ai/defaults.ts`. Взять их из Google AI Studio
в момент реализации: для анализа — модель семейства **Flash** с бесплатным
тарифом, для проверки — **Flash-Lite** (у неё дневной бесплатный лимит
заметно больше). Окончательный выбор — по итогам фазы 0.

**Для скрипта фазы 0** (`.env.local`, в `.gitignore`):
```
GEMINI_API_KEY=
GEMINI_MODEL=
```

**Vite:** `base: '/wortwechsel/'` (имя репозитория); manifest
`start_url` и `scope` — с тем же префиксом.

## 8. Клиент

- **Навигация (нижняя панель):** Говорить · Повторить (бейдж с числом) ·
  Выражения · Настройки.
- **Тексты интерфейса** — только из `src/i18n/ru.ts`.
- **Распознавание речи** — хук `useSpeechRecognition()`:
  - `window.SpeechRecognition || window.webkitSpeechRecognition`;
    `lang: 'de-DE'`, `continuous: true`, `interimResults: true`;
  - промежуточный текст показывается сразу, пока она говорит;
  - останавливается кнопкой «Стоп» или через 60 с;
  - если браузер сам завершил распознавание на паузе, а Лена «Стоп» не
    нажимала, — перезапуск с сохранением уже распознанного;
  - браузер не поддерживает → режим ввода текстом (кнопка микрофона скрыта).
- **Подсветка в повторении:** `original` ищется в `transcript` без учёта
  регистра; если не найдено — фраза без подсветки, а слово выводится
  отдельной строкой «Без: …».
- **Учёт запросов:** счётчик в `usage` по дням; в настройках —
  «Сегодня: анализ N, проверка M».
- **Лимит бесплатного тарифа (`QUOTA`):** сообщение «Бесплатный лимит на
  сегодня исчерпан. Он обновится около 9:00 утра.» (сброс квоты — полночь
  по тихоокеанскому времени). Сохранённые данные и «Выражения» доступны.
- **Мобильная вёрстка:** ширина 360–430 px — основной сценарий; кнопка
  записи большая, в зоне большого пальца; тёмная тема по
  `prefers-color-scheme`.

## 9. Безопасность и приватность

- Ключ API — только в IndexedDB на устройстве Лены. Никогда в коде, в
  репозитории, в логах, в URL. Поле ввода — как пароль.
- Для приложения — **отдельный ключ с ограничениями** в Google Cloud Console:
  по сайту (`https://<логин>.github.io/*`) и по API (только Generative
  Language API). Если ключ утечёт, с другого сайта он не сработает.
  Для скрипта фазы 0 на ПК — второй ключ, без ограничения по сайту,
  только в `.env.local`.
- Репозиторий публичный (GitHub Pages на бесплатном тарифе) → в
  репозитории нет личных данных: `validation/phrases.txt` и отчёты в
  `.gitignore`.
- На бесплатном тарифе Google может использовать тексты запросов для
  улучшения своих продуктов. В интерфейсе «Говорить» — неброская
  подсказка: «Не называй имён, адресов, данных о здоровье».
- Распознавание речи в Chrome тоже идёт через серверы Google.
- Аудио нигде не сохраняется.
