# T02 — Хранилище и логика повторения

**Зависит от:** T01 · **Размер:** M · **Делает:** любой агент
**Источник правды:** `docs/architecture.md` §4–5.

## Входит

### `src/srs/scheduler.ts`
- Экземпляр FSRS (`ts-fsrs`) с параметрами из §5.
- `serializeCard(card): SerializedCard` / `deserializeCard(s): Card` —
  все `Date` ↔ epoch ms.
- `firstDueAfterSave(now: Date): number` — начало следующего календарного
  дня + 4 часа, по местному времени устройства.
- `reviewCard(card, now, rating): SerializedCard`.

### `src/srs/rating.ts`
```ts
rateTarget(t: TargetResult, ctx: {
  hintUsed: boolean;
  meaningPreserved: boolean;
  naturalness: 'natural' | 'understandable' | 'unnatural';
  easyTapped: boolean;
}): 1 | 2 | 3 | 4
```
Строго по таблице §5, сверху вниз.

### `src/db/db.ts`
Схема Dexie версии 1 и типы из §4 (`AnalyzeResponse`, `EvaluateResponse`
импортировать из `src/ai/contracts.generated.ts`).

### `src/db/repo.ts` — единственная точка доступа к БД
- `saveUtterance(input: { context, question, rawTranscript, transcript, analysis }, selected: Suggestion[]): Promise<{ utteranceId; itemIds }>`
  — одна транзакция; для каждой выбранной замены создаёт `Item`
  (`card = createEmptyCard()`, `due = firstDueAfterSave(now)`,
  `correctDays = []`, `stage = 'learning'`). Повтор того же `lemma` +
  `replacement`, который уже есть и не `suspended`, не создаётся заново —
  функция возвращает его id (дубликаты не нужны).
- `countDue(now): Promise<number>`.
- `getDueGroups(now, limit): Promise<DueGroup[]>`, где
  `DueGroup = { utterance: Utterance; items: Item[] }` — только items с
  `due <= now` и `stage !== 'suspended'`, группировка по `utteranceId`,
  сортировка по минимальному `due`, общее число items ≤ `limit` (группа
  не режется: если не влезает целиком — не берётся).
- `applyReview(input: { utteranceId; items: Item[]; kind; answerTranscript; hintUsed; evaluation; easyTapped }, now)`
  — в одной транзакции: `rateTarget` для каждого item → `reviewCard` →
  обновить `card`, `due`; при Rating ≥ 3 добавить сегодняшнюю дату в
  `correctDays` без дублей; если `correctDays.length >= 3` → `stage = 'active'`;
  записать `Review` с `ratings`.
- `reviewedTodayCount(now)` — сколько items уже повторено сегодня
  (для дневного лимита).
- `listItems(stage?)`, `setItemStage(id, stage)`, `deleteItem(id)`.
- `makeAllDueNow()` — только для отладки (T07). В режиме разработки
  (`import.meta.env.DEV`) `repo` доступен в консоли как `window.__wortwechsel.repo`.
- `exportAll(): ExportFile` и `importAll(file, mode: 'replace' | 'merge')`.
  `ExportFile = { app: 'wortwechsel'; version: 1; exportedAt: number; utterances; items; reviews }`.
  `merge` — по `id`, при совпадении побеждает запись с большим `createdAt`
  / `reviewedAt`. Неверный `app`/`version` → понятная ошибка.
- `incrementUsage(kind: 'analyze' | 'evaluate', now)`,
  `getUsage(fromDay, toDay)`.
- `getSetting<T>(key, fallback)`, `setSetting(key, value)`.

## Тесты (Vitest + `fake-indexeddb`)
- `rateTarget`: каждая строка таблицы + Easy.
- `firstDueAfterSave`: 10:00 → завтра 04:00; 23:59 → завтра 04:00;
  переход на зимнее время (последнее воскресенье октября, Europe/Berlin).
- `getDueGroups`: группировка, лимит, `suspended` не попадает, будущие не попадают.
- `applyReview`: Again не добавляет день; три Good в разные дни → `active`;
  два Good в один день → один день в `correctDays`.
- `saveUtterance`: дубликат не создаётся.
- `exportAll` → `importAll('replace')` даёт те же данные.

## Не входит
UI.

## Готово, когда
Все тесты зелёные, покрытие `src/srs/` — 100% строк, `STATUS.md` обновлён.
