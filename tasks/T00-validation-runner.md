# T00 — Скрипт проверки промпта (фаза 0)

**Зависит от:** — · **Размер:** S · **Делает:** любой агент

## Зачем
До того как писать приложение, убедиться, что анализ фраз даёт полезные
замены. Скрипт прогоняет реальные фразы Лены через `prompts/analyze.md`
на Gemini API и делает читаемый отчёт.

## Входит
- Минимальный `package.json` (`"type": "module"`, `"private": true`,
  dev-зависимость `ajv`). Сеть — встроенный `fetch` Node, без SDK.
  Скрипт `"validate": "node --env-file=.env.local scripts/validate-prompts.mjs"`.
- `scripts/lib/schema-utils.mjs` — функция `toProviderSchema(schema)`:
  глубокая копия схемы без ключей `title` и `$schema` на всех уровнях.
  Её потом переиспользует `sync-contracts.mjs` (T01).
- `scripts/validate-prompts.mjs`:
  1. читает `validation/phrases.txt`, а если его нет —
     `validation/phrases.example.txt`. Формат: `work | Ich habe …`;
     пустые строки и строки с `#` пропускаются; контекст по умолчанию `free`;
  2. для каждой фразы — запрос к Gemini точно как в
     `docs/architecture.md` §6 «Запрос к Gemini»: `systemInstruction` =
     текст `prompts/analyze.md`, текст пользователя =
     `JSON.stringify({ transcript, context })`, `responseJsonSchema` =
     `toProviderSchema(schemas/analyze.schema.json)`. Ключ —
     `GEMINI_API_KEY`, модель — `GEMINI_MODEL` или флаг `--model=…`;
  3. парсит ответ, проверяет `ajv` по `schemas/analyze.schema.json`;
     проверяет, что каждый `suggestions[].original` — подстрока фразы
     (если нет — пометка `⚠ original не найден`);
  4. запросы по одному, пауза между ними `--delay=` секунд (по умолчанию 13,
     чтобы не упереться в лимит в минуту); флаг `--limit=N` — только первые N
     фраз; при ответе 429 — остановиться и сохранить то, что уже есть,
     с пометкой «дневной лимит исчерпан»; ошибка одной фразы не роняет прогон.
- Результат:
  - `validation/report.json` — сырые ответы + имя модели;
  - `validation/report.md` — для чтения с телефона (формат ниже), в шапке
    модель и дата.
- `.env.example` (`GEMINI_API_KEY=`, `GEMINI_MODEL=`).
- `.gitignore`: `.env.local`, `node_modules`, `dist`,
  `validation/phrases.txt`, `validation/report.*`.

## Формат `report.md`

```markdown
## 3. work — Wir müssen das bis Freitag machen.

**Исправлено:** — (или исправленная фраза)
**Улучшено:** Wir müssen das bis Freitag erledigen.

- [ ] ✅ / 🤔 / ❌  **machen → erledigen** (erledigen · etw. erledigen · neutral)
  сделать, закончить — Про задачи с дедлайном.
  _Ich erledige das gleich._

Оставить: —  ·  Слабые слова: machen
```

## Не входит
Никакого UI, Vite, React. Только скрипт.

## Готово, когда
- `npm run validate -- --limit=3` на трёх фразах из
  `validation/phrases.example.txt` даёт отчёт без ошибок схемы.
- Ключ API нигде не логируется и не попадает в отчёт.
- `STATUS.md` обновлён.

## Как проверить (Лена)
1. Получить бесплатный ключ в Google AI Studio (инструкция в
   `validation/checklist.md`) и вписать его в `.env.local`.
2. Скопировать `validation/phrases.example.txt` в `validation/phrases.txt`
   и вписать свои фразы.
3. `npm install`, затем `npm run validate`.
4. Открыть `validation/report.md` и отметить каждую замену.
