# T01 — Каркас приложения

**Зависит от:** T00 (уже есть `package.json`) · **Размер:** M · **Делает:** любой агент

## Входит
- Vite + React + TypeScript (`strict: true`) **в существующий** `package.json`.
  Не запускать `npm create vite` поверх папки: создать шаблон во временной
  папке и перенести файлы, либо добавить зависимости вручную.
- `vite.config.ts`: `base: '/wortwechsel/'`.
- Структура папок из `docs/architecture.md` §3 (пустые папки — с `.gitkeep`).
- `HashRouter`: маршруты `#/speak` (по умолчанию), `#/review`,
  `#/expressions`, `#/settings`.
- Нижняя навигация из 4 вкладок, иконки — inline SVG, подписи из
  `src/i18n/ru.ts`: «Говорить», «Повторить», «Выражения», «Настройки».
- `src/styles/tokens.css`: цвета (светлая и тёмная тема через
  `prefers-color-scheme`), отступы 4/8/12/16/24/32, радиусы, размеры шрифта,
  `--tap-size: 48px`. `global.css`: сброс, системный шрифт, `body` с явным фоном.
- `vite-plugin-pwa`: manifest (`name` и `short_name`: `"Wortwechsel"`,
  `lang: "ru"`, `display: "standalone"`, `start_url` и `scope` =
  `/wortwechsel/`, цвета из токенов), иконки 192 и 512 (буква «W» на цветном
  фоне, сгенерировать скриптом), service worker кэширует оболочку приложения.
- **`scripts/sync-contracts.mjs`** (`npm run sync`, а также `prebuild` и `pretest`)
  пишет `src/ai/contracts.generated.ts`:
  - типы из `schemas/*.schema.json` через `json-schema-to-typescript`;
  - `export const ANALYZE_PROMPT`, `EVALUATE_PROMPT` — строки из `prompts/`;
  - `export const ANALYZE_SCHEMA`, `EVALUATE_SCHEMA` — результат
    `toProviderSchema` из `scripts/lib/schema-utils.mjs`;
  - `export const ANALYZE_SCHEMA_FULL`, `EVALUATE_SCHEMA_FULL` — исходные
    схемы (для проверки `ajv`);
  - первая строка: `// СГЕНЕРИРОВАНО scripts/sync-contracts.mjs — не редактировать`.
- ESLint (typescript-eslint, react-hooks) + Prettier, Vitest (окружение jsdom).
- **Проверка на телефоне без интернета-публикации:** скрипт `dev:phone` —
  `vite --host` с плагином `@vitejs/plugin-basic-ssl` (только в этом режиме).
  Микрофон в Chrome работает лишь по HTTPS, поэтому нужен самоподписанный
  сертификат. Телефон и ПК — в одном Wi-Fi; адрес вида
  `https://192.168.x.x:5173/wortwechsel/`; предупреждение браузера о
  сертификате принять. Инструкцию для Лены — в `README.md`.
- Скрипты: `dev`, `dev:phone`, `build`, `preview`, `test`, `lint`, `sync`, `validate` (из T00).

## Не входит
Логика страниц, БД, AI — только пустые страницы с заголовком.
Публикация — в T08.

## Готово, когда
- `npm run sync && npm run lint && npm test && npm run build` — без ошибок.
- `npm run dev` на ширине 360 px: нижняя панель, переключение вкладок,
  тёмная тема.
- `npm run dev:phone` открывается на телефоне Лены по Wi-Fi.
- `npm run preview`: Lighthouse (Chrome DevTools) показывает, что
  приложение устанавливаемое.
- `STATUS.md` обновлён.
