# T04 — Распознавание речи (Web Speech API)

**Зависит от:** T01 · **Размер:** S · **Делает:** любой агент
**Источник правды:** `docs/architecture.md` §8, D-017.

## Входит
- `src/features/speech/useSpeechRecognition.ts`:
  ```ts
  type SpeechState = 'idle' | 'listening' | 'stopped' | 'error';
  useSpeechRecognition({ lang = 'de-DE', maxSeconds = 60 }) => {
    supported: boolean,
    state, seconds,
    finalText: string,     // подтверждённый текст
    interimText: string,   // то, что распознаётся прямо сейчас
    error: 'denied' | 'no-speech' | 'network' | 'unknown' | null,
    start(), stop(), reset()
  }
  ```
  - `window.SpeechRecognition || window.webkitSpeechRecognition`
    (типы объявить в `src/features/speech/speech.d.ts`);
  - `continuous: true`, `interimResults: true`;
  - `onresult`: финальные куски добавляются в `finalText` через пробел,
    промежуточный — в `interimText`;
  - если `onend` пришёл, а `stop()` не вызывали и 60 с не истекли —
    перезапустить распознавание (Chrome на Android обрывает его на паузах);
  - автостоп через `maxSeconds`; `seconds` обновляется раз в секунду;
  - `onerror`: `not-allowed` → `denied`, `no-speech` → `no-speech`,
    `network` → `network`, прочее → `unknown`;
  - очистка при размонтировании.
- `src/components/RecordButton.tsx` — круглая кнопка 72 px в нижней трети
  экрана: «Нажми и говори» → во время записи таймер `0:12 / 1:00`,
  пульсация и надпись «Стоп». Под кнопкой — живой текст
  (`finalText` + серым `interimText`).
- Сообщения из `ru.ts`:
  - denied: «Нет доступа к микрофону. Разреши его в настройках браузера.»
  - no-speech: «Ничего не услышала. Попробуй ещё раз.»
  - network: «Распознаванию речи нужен интернет.»
  - не поддерживается: кнопка не показывается, вместо неё поле ввода и
    подпись «Этот браузер не распознаёт речь — введи фразу текстом.»
- Доступность: `aria-pressed`, подпись меняется вместе с состоянием.

## Тесты
Мок `SpeechRecognition`: сборка `finalText` из нескольких событий,
перезапуск после самопроизвольного `onend`, автостоп, ошибка доступа,
`supported: false` без API.

## Готово, когда
Тесты зелёные; на ПК в Chrome фраза на немецком появляется текстом во
время речи; `STATUS.md` обновлён.
