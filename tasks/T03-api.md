# T03 — AI-слой: запросы к Gemini API

**Зависит от:** T01 (сгенерированные контракты), T02 (настройки и `usage`) ·
**Размер:** M · **Делает:** любой агент
**Источник правды:** `docs/architecture.md` §6, §7, §9.

## Входит
- `src/ai/errors.ts` — `class AiError extends Error { code }` с кодами из §6.
- `src/ai/defaults.ts` — `DEFAULT_ANALYZE_MODEL`, `DEFAULT_EVALUATE_MODEL`
  (актуальные бесплатные модели Flash и Flash-Lite из Google AI Studio;
  в комментарии — дата проверки).
- `src/ai/gemini.ts`:
  ```ts
  generateStructured(opts: {
    apiKey: string; model: string;
    systemPrompt: string; userText: string; schema: object;
    signal: AbortSignal;
  }): Promise<unknown>   // уже распарсенный JSON
  ```
  Запрос и разбор ответа — по §6; соответствие HTTP-ответов и кодов
  `AiError` — по таблице «Ошибки». Имена полей сверить с документацией
  Gemini API на момент реализации.
- `src/ai/postprocess.ts` — `checkAnalyze(raw)`, `checkEvaluate(raw, request)`:
  `ajv` по `*_SCHEMA_FULL`, обрезка массивов, проверка и упорядочивание
  `targets` по §6. Ошибка → `AiError('BAD_RESPONSE')`.
- `src/ai/client.ts` — `analyze(req)`, `evaluate(req)`:
  1. проверка входа (§6) → `BAD_REQUEST` без сети;
  2. ключ из `repo.getSetting('apiKey')`, нет → `NO_KEY`;
  3. модель из настроек или `defaults.ts`;
  4. таймаут 30 с;
  5. `BAD_RESPONSE` → один повтор, затем ошибка;
  6. успех → `repo.incrementUsage(kind)`.
- `navigator.onLine === false` → сразу `NETWORK`.

## Тесты (`fetch` мокается)
- нет ключа → `NO_KEY`, сеть не вызывается;
- 403 → `BAD_KEY`; 429 → `QUOTA`; `finishReason: 'SAFETY'` → `BLOCKED`;
- невалидный JSON дважды → `BAD_RESPONSE` и ровно 2 запроса;
  невалидный, затем валидный → успех;
- analyze: 5 suggestions в ответе → 3 после обработки;
- evaluate: потерянный `id` → `BAD_RESPONSE`; перепутанный порядок → исправлен;
- в теле запроса — `systemInstruction` с промптом и схема без `title`;
- ключ не попадает ни в URL, ни в `console`.

## Ручная проверка
Временная страница или тест с реальным ключом (ключ — из переменной
окружения, не в коде): analyze на фразе из примера 1 промпта возвращает
валидный ответ. Временный код удалить.

## Не входит
UI.

## Готово, когда
Тесты зелёные; ручная проверка пройдена; `STATUS.md` обновлён.
