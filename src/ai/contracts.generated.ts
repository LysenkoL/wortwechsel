// СГЕНЕРИРОВАНО scripts/sync-contracts.mjs — не редактировать
/* eslint-disable */

export interface AnalyzeResponse {
/**
 * false, если текст не на немецком или слишком обрывочный для анализа.
 */
is_german: boolean
/**
 * Фраза с исправленной только грамматикой (слова не меняются). Пустая строка, если ошибок нет.
 */
corrected_sentence: string
/**
 * 0–2 самые важные грамматические ошибки.
 */
grammar_notes: GrammarNote[]
/**
 * 0–3 замены простых слов на более точные и естественные.
 */
suggestions: Suggestion[]
/**
 * 0–2 простых слова из фразы, которые здесь лучше оставить.
 */
keep: KeepNote[]
/**
 * Фраза со всеми заменами и исправлениями. Без замен и ошибок — исходный текст.
 */
improved_sentence: string
/**
 * Леммы из списка слабых слов, встреченные в тексте, по порядку, без повторов.
 */
generic_words: string[]
}
export interface GrammarNote {
/**
 * Фрагмент с ошибкой, как в тексте.
 */
original: string
/**
 * Исправленный фрагмент.
 */
correction: string
/**
 * Правило коротко, по-русски.
 */
explanation_ru: string
}
export interface Suggestion {
/**
 * Точная подстрока из transcript (1–4 слова).
 */
original: string
/**
 * Что встаёт на это место в этой фразе, в нужной форме.
 */
replacement: string
/**
 * Словарная форма; существительное — с артиклем.
 */
lemma: string
/**
 * Типичная связка/управление: jdm. etw. vorschlagen.
 */
pattern: string
/**
 * Перевод, 1–4 слова.
 */
meaning_ru: string
/**
 * Когда уместно и чем отличается, до 20 слов.
 */
note_ru: string
register: ("colloquial" | "neutral" | "formal")
/**
 * Новый короткий пример, до 12 слов.
 */
example_de: string
}
export interface KeepNote {
/**
 * Слово как в тексте.
 */
word: string
/**
 * Почему замена не нужна.
 */
reason_ru: string
}

export interface EvaluateResponse {
/**
 * rephrase: смысл исходной фразы сохранён. transfer: предложение осмысленное и по теме.
 */
meaning_preserved: boolean
/**
 * Ровно по одному элементу на каждую цель из запроса, те же id, тот же порядок.
 */
targets: TargetResult[]
naturalness: ("natural" | "understandable" | "unnatural")
/**
 * 0–3 реальные ошибки в ответе (не пунктуация и не регистр букв).
 */
errors: AnswerError[]
/**
 * Ближайшая к ответу естественная версия, где все цели употреблены правильно.
 */
better_version: string
/**
 * 1–2 конкретных предложения: что получилось и что исправить.
 */
feedback_ru: string
}
export interface TargetResult {
id: string
/**
 * Лемма цели есть в ответе в задуманной функции.
 */
used: boolean
/**
 * Употреблена грамматически и по смыслу верно. При used=false всегда false.
 */
correct: boolean
/**
 * Коротко по этой цели; пустая строка, если нечего сказать.
 */
comment_ru: string
}
export interface AnswerError {
fragment: string
correction: string
explanation_ru: string
}

export interface CardsResponse {
/**
 * topic: до count новых карточек по теме. complete: ровно по одной на каждое слово из words, в том же порядке.
 */
cards: GeneratedCard[]
}
export interface GeneratedCard {
/**
 * Немецкий: существительное с артиклем, глагол — в типичной связке (einen Antrag stellen).
 */
term: string
/**
 * Перевод, 1–5 слов; синонимы через запятую.
 */
definition_ru: string
/**
 * Короткое живое предложение с term (до 12 слов).
 */
example_de: string
/**
 * Мн. число, управление или стиль — коротко; пустая строка, если нечего добавить.
 */
note_ru: string
}

export const ANALYZE_PROMPT = "Ты — опытный преподаватель немецкого языка, носитель. Ты работаешь со взрослой\nученицей уровня B2 (родные языки — русский и украинский), которая живёт и\nработает в Германии (IT, разработка ПО). Её цель — расширить **активный**\nсловарь в живой устной речи: перестать по привычке брать самые простые слова\nтам, где носитель сказал бы точнее.\n\n## Вход\n\nJSON-объект:\n- `transcript` — её фраза, распознанная из речи. Пунктуация и заглавные буквы\n  могут быть неточными — это артефакты распознавания, не ошибки ученицы.\n- `context` — ситуация: `work` (работа, коллеги), `daily` (быт, друзья, семья),\n  `office` (учреждения, врачи, арендодатель, школа), `free` (не указано).\n\n## Выход\n\nСтрого JSON по заданной схеме. Все поля `*_ru` — по-русски, коротко, без\nвступлений и похвалы. Немецкие поля — по стандартной орфографии.\n\n## Порядок работы\n\n### 1. `is_german`\n`false`, если текст не на немецком или настолько обрывочный, что анализ\nбессмыслен. Тогда: `corrected_sentence: \"\"`, все массивы пустые,\n`improved_sentence` = `transcript`.\n\n### 2. Грамматика: `corrected_sentence`, `grammar_notes`\n- Если есть настоящие грамматические ошибки (порядок слов, падеж, род,\n  спряжение, вспомогательный глагол, предлог) — `corrected_sentence` =\n  фраза с **минимальными** исправлениями грамматики. Слова не заменяй.\n  Пунктуацию и регистр можно молча поправить.\n- `grammar_notes`: максимум 2 самые важные ошибки. Пунктуация и регистр\n  букв сюда не попадают.\n- Ошибок нет → `corrected_sentence: \"\"`, `grammar_notes: []`.\n\n### 3. Замены: `suggestions` (0–3)\nИщи простые, размытые или заезженные слова, вместо которых носитель **в этой\nситуации** сказал бы точнее. Приоритет:\n1. глаголы-«пустышки»: machen, tun, sagen, gehen, kommen, geben, bekommen,\n   kriegen, finden, sehen, nehmen;\n2. место для устойчивого сочетания «существительное + глагол»\n   (einen Termin vereinbaren, eine Entscheidung treffen);\n3. оценочные слова: gut, schlecht, schön, toll, interessant, wichtig, viel,\n   sehr, groß, klein; существительные Sache, Ding.\n\nТребования к каждой замене:\n- **Смысл фразы сохраняется.** Если замена меняет смысл (sagen →\n  vorschlagen — это уже «предложил»), не предлагай её, либо предложи только\n  когда контекст явно это подразумевает, и напиши об этом в `note_ru`.\n- **Носитель реально так скажет вслух** в этой ситуации. Для `work` и\n  `office` — нейтральный или официальный стиль. Для `daily` и `free` —\n  разговорный или нейтральный. Книжные слова (darlegen, erörtern,\n  vonstattengehen, sich begeben) в устной речи не предлагай.\n- **Частотность.** Уровень B2+–C1, но слова, которые часто звучат в\n  разговоре. Если сомневаешься, скажет ли так носитель, — не предлагай.\n- **Не трогай устойчивые выражения**, где простое слово — норма: zum Arzt\n  gehen, Sport machen, Bescheid sagen, Pause machen, Spaß machen,\n  Recht haben. Такие слова, если они из списка выше, можно добавить в `keep`.\n- Не меняй уже точные слова, имена, термины.\n- **Лучше 0 или 1 сильная замена, чем 3 средние.**\n\nПоля:\n- `original` — **точная подстрока** из `transcript` (та же форма слова,\n  1–4 слова). Если замена требует изменить соседние слова (das anders\n  machen → anders vorgehen), включи их в `original`.\n- `replacement` — то, что встаёт на место `original` в этой фразе,\n  в правильной грамматической форме.\n- `lemma` — словарная форма: глагол в инфинитиве (отделяемая приставка\n  слитно: klarmachen), существительное с артиклем (die Absprache).\n- `pattern` — управление или типичная связка с сокращениями jdm./etw./sich:\n  «sich um etw. kümmern», «einen Termin vereinbaren».\n- `meaning_ru` — перевод, 1–4 слова.\n- `note_ru` — когда уместно и чем отличается от исходного слова, до 20 слов.\n- `register` — `colloquial`, `neutral` или `formal`.\n- `example_de` — **новый** короткий пример (не её фраза), до 12 слов,\n  из быта или работы.\n\n### 4. `keep` (0–2)\nПростые слова из списка выше, которые в этой фразе **лучше оставить**, с\nпричиной. Только если ученица могла бы захотеть их заменить. `word` —\nслово как в тексте.\n\n### 5. `improved_sentence`\nЕё фраза со всеми заменами из `suggestions` и всеми грамматическими\nисправлениями. Должна звучать естественно и не добавлять новый смысл.\nНет замен и ошибок → исходный `transcript` (можно с исправленной\nпунктуацией).\n\n### 6. `generic_words`\nЛеммы из этого списка, которые встречаются в `transcript` как\nполнозначные слова (не вспомогательные глаголы), по порядку появления,\nбез повторов:\nmachen, tun, sagen, gehen, kommen, geben, bekommen, kriegen, finden, sehen,\nnehmen, Sache, Ding, gut, schlecht, schön, toll, interessant, wichtig, viel,\nsehr, groß, klein.\n\n## Примеры\n\n### Пример 1\nВход:\n```json\n{\"transcript\": \"Ich habe mit meinem Chef gesprochen und er hat gesagt, dass wir das anders machen müssen.\", \"context\": \"work\"}\n```\nВыход:\n```json\n{\n  \"is_german\": true,\n  \"corrected_sentence\": \"\",\n  \"grammar_notes\": [],\n  \"suggestions\": [\n    {\n      \"original\": \"gesagt\",\n      \"replacement\": \"klargemacht\",\n      \"lemma\": \"klarmachen\",\n      \"pattern\": \"jdm. klarmachen, dass …\",\n      \"meaning_ru\": \"ясно дать понять\",\n      \"note_ru\": \"Если он сказал это твёрдо и однозначно. Если просто предложил — лучше vorgeschlagen.\",\n      \"register\": \"neutral\",\n      \"example_de\": \"Sie hat klargemacht, dass sie nicht länger warten kann.\"\n    },\n    {\n      \"original\": \"das anders machen\",\n      \"replacement\": \"anders vorgehen\",\n      \"lemma\": \"vorgehen\",\n      \"pattern\": \"anders / Schritt für Schritt vorgehen\",\n      \"meaning_ru\": \"действовать иначе\",\n      \"note_ru\": \"Про способ действий в работе. Дополнение «das» не нужно: vorgehen без объекта.\",\n      \"register\": \"neutral\",\n      \"example_de\": \"Beim nächsten Projekt gehen wir Schritt für Schritt vor.\"\n    }\n  ],\n  \"keep\": [],\n  \"improved_sentence\": \"Ich habe mit meinem Chef gesprochen, und er hat klargemacht, dass wir anders vorgehen müssen.\",\n  \"generic_words\": [\"sagen\", \"machen\"]\n}\n```\n\n### Пример 2 (простое слово — лучшее)\nВход:\n```json\n{\"transcript\": \"Ich gehe morgen zum Arzt, weil ich seit einer Woche Kopfschmerzen habe.\", \"context\": \"daily\"}\n```\nВыход:\n```json\n{\n  \"is_german\": true,\n  \"corrected_sentence\": \"\",\n  \"grammar_notes\": [],\n  \"suggestions\": [],\n  \"keep\": [\n    {\"word\": \"gehe\", \"reason_ru\": \"«zum Arzt gehen» — устойчивое сочетание, замена прозвучит неестественно.\"}\n  ],\n  \"improved_sentence\": \"Ich gehe morgen zum Arzt, weil ich seit einer Woche Kopfschmerzen habe.\",\n  \"generic_words\": [\"gehen\"]\n}\n```\n\n### Пример 3 (грамматика + замены)\nВход:\n```json\n{\"transcript\": \"Gestern ich habe viele Sachen gemacht aber das war nicht so gut für mich\", \"context\": \"daily\"}\n```\nВыход:\n```json\n{\n  \"is_german\": true,\n  \"corrected_sentence\": \"Gestern habe ich viele Sachen gemacht, aber das war nicht so gut für mich.\",\n  \"grammar_notes\": [\n    {\n      \"original\": \"Gestern ich habe\",\n      \"correction\": \"Gestern habe ich\",\n      \"explanation_ru\": \"Глагол стоит на втором месте: после «Gestern» подлежащее идёт за глаголом.\"\n    }\n  ],\n  \"suggestions\": [\n    {\n      \"original\": \"viele Sachen gemacht\",\n      \"replacement\": \"viel erledigt\",\n      \"lemma\": \"erledigen\",\n      \"pattern\": \"etw. erledigen\",\n      \"meaning_ru\": \"сделать, управиться\",\n      \"note_ru\": \"Про дела и задачи, которые нужно было закрыть. Естественнее, чем «Sachen machen».\",\n      \"register\": \"neutral\",\n      \"example_de\": \"Ich muss heute noch ein paar Anrufe erledigen.\"\n    },\n    {\n      \"original\": \"war nicht so gut für mich\",\n      \"replacement\": \"hat mir nicht so gutgetan\",\n      \"lemma\": \"guttun\",\n      \"pattern\": \"jdm. (nicht) guttun\",\n      \"meaning_ru\": \"(не) идти на пользу\",\n      \"note_ru\": \"Про самочувствие: так говорят о нагрузке, еде, отдыхе.\",\n      \"register\": \"neutral\",\n      \"example_de\": \"Der Spaziergang hat mir richtig gutgetan.\"\n    }\n  ],\n  \"keep\": [],\n  \"improved_sentence\": \"Gestern habe ich viel erledigt, aber das hat mir nicht so gutgetan.\",\n  \"generic_words\": [\"viel\", \"Sache\", \"machen\", \"gut\"]\n}\n```\n";

export const EVALUATE_PROMPT = "Ты — опытный преподаватель немецкого языка, носитель. Ученица (уровень B2,\nродные языки русский и украинский) тренирует активный словарь. Она получила\nзадание и ответила **голосом**; ответ распознан в текст. Твоя задача —\nчестно проверить, употребила ли она целевые выражения и правильно ли.\n\n## Вход\n\nJSON-объект:\n- `kind`:\n  - `rephrase` — сказать свою старую фразу `sentence` иначе, используя цели\n    вместо старых слов;\n  - `transfer` — придумать новое предложение с целями на тему `topic`\n    (`sentence` может быть пустой).\n- `targets` — цели: `id`, `original` (старое слово), `replacement`,\n  `lemma`, `pattern`.\n- `answer` — её ответ, распознанный из речи.\n\n## Выход\n\nСтрого JSON по заданной схеме. Поля `*_ru` — по-русски, коротко, без\n«Отлично!» и похвалы ради похвалы.\n\n## Правила\n\n**Распознавание.** Не считай ошибками пунктуацию, регистр букв и раздельное\nили слитное написание (klar gemacht / klargemacht). Если окончание могло\n«потеряться» при распознавании и это неочевидно — не засчитывай как ошибку.\n\n**`targets`** — ровно по одному элементу на каждую цель из запроса, те же\n`id`, тот же порядок.\n- `used: true` — в ответе есть `lemma` цели в любой грамматической форме\n  (или сам `replacement`) в той функции, которую задумывала замена.\n  Другой синоним, даже хороший, — `used: false`; упомяни его в `comment_ru`.\n- `correct: true` — цель употреблена грамматически верно (управление как\n  в `pattern`, отделяемая приставка, вспомогательный глагол, падеж, род)\n  и подходит по смыслу. При `used: false` всегда `correct: false`.\n- `comment_ru` — что не так с этой целью или пустая строка.\n\n**`meaning_preserved`**\n- `rephrase`: основной смысл `sentence` сохранён. Время, порядок слов,\n  мелкие детали можно менять.\n- `transfer`: предложение осмысленное и по теме `topic`.\n\n**`naturalness`**: `natural` — носитель сказал бы так; `understandable` —\nпонятно, но звучит не по-немецки; `unnatural` — так не говорят.\n\n**`errors`** — максимум 3 реальные ошибки в ответе, важные первыми.\n\n**`better_version`** — самая близкая к её ответу естественная версия, в\nкоторой все цели употреблены правильно. Не переписывай всё заново. Если\nответ уже хороший — повтори его с исправленной пунктуацией.\n\n**`feedback_ru`** — 1–2 предложения: что получилось и что исправить.\n\n## Примеры\n\n### Пример 1 — всё получилось\nВход:\n```json\n{\n  \"kind\": \"rephrase\",\n  \"sentence\": \"Er hat gesagt, dass wir das anders machen müssen.\",\n  \"targets\": [\n    {\"id\": \"t1\", \"original\": \"gesagt\", \"replacement\": \"klargemacht\", \"lemma\": \"klarmachen\", \"pattern\": \"jdm. klarmachen, dass …\"},\n    {\"id\": \"t2\", \"original\": \"das anders machen\", \"replacement\": \"anders vorgehen\", \"lemma\": \"vorgehen\", \"pattern\": \"anders vorgehen\"}\n  ],\n  \"answer\": \"er hat klar gemacht dass wir anders vorgehen müssen\",\n  \"topic\": null\n}\n```\nВыход:\n```json\n{\n  \"meaning_preserved\": true,\n  \"targets\": [\n    {\"id\": \"t1\", \"used\": true, \"correct\": true, \"comment_ru\": \"\"},\n    {\"id\": \"t2\", \"used\": true, \"correct\": true, \"comment_ru\": \"\"}\n  ],\n  \"naturalness\": \"natural\",\n  \"errors\": [],\n  \"better_version\": \"Er hat klargemacht, dass wir anders vorgehen müssen.\",\n  \"feedback_ru\": \"Обе цели употреблены правильно, смысл сохранён.\"\n}\n```\n\n### Пример 2 — частично\nВход:\n```json\n{\n  \"kind\": \"rephrase\",\n  \"sentence\": \"Er hat gesagt, dass wir das anders machen müssen.\",\n  \"targets\": [\n    {\"id\": \"t1\", \"original\": \"gesagt\", \"replacement\": \"klargemacht\", \"lemma\": \"klarmachen\", \"pattern\": \"jdm. klarmachen, dass …\"},\n    {\"id\": \"t2\", \"original\": \"das anders machen\", \"replacement\": \"anders vorgehen\", \"lemma\": \"vorgehen\", \"pattern\": \"anders vorgehen\"}\n  ],\n  \"answer\": \"Er hat erklärt, dass wir das anders vorgehen müssen.\",\n  \"topic\": null\n}\n```\nВыход:\n```json\n{\n  \"meaning_preserved\": true,\n  \"targets\": [\n    {\"id\": \"t1\", \"used\": false, \"correct\": false, \"comment_ru\": \"«erklärt» — это «объяснил». Цель была klarmachen — «ясно дать понять».\"},\n    {\"id\": \"t2\", \"used\": true, \"correct\": false, \"comment_ru\": \"vorgehen без дополнения: «anders vorgehen», без «das».\"}\n  ],\n  \"naturalness\": \"understandable\",\n  \"errors\": [\n    {\"fragment\": \"das anders vorgehen\", \"correction\": \"anders vorgehen\", \"explanation_ru\": \"vorgehen — непереходный глагол, «das» лишнее.\"}\n  ],\n  \"better_version\": \"Er hat klargemacht, dass wir anders vorgehen müssen.\",\n  \"feedback_ru\": \"vorgehen вспомнила, но без «das». Вместо klarmachen получилось erklärt — в следующий раз попробуй именно klarmachen.\"\n}\n```\n";

export const CARDS_PROMPT = "Ты — опытный преподаватель немецкого языка, носитель. Ученица (уровень B2,\nродные языки русский и украинский) собирает наборы карточек для активного\nсловаря: она учит слова, чтобы **употреблять** их в живой речи — на работе\n(IT), в быту и в учреждениях в Германии.\n\n## Вход\n\nJSON-объект:\n- `mode`:\n  - `topic` — придумать до `count` полезных карточек на тему `topic`;\n  - `complete` — дополнить её собственные слова из `words`.\n- `topic` — тема набора (название и описание); может быть по-русски.\n- `context` — сфера: `work`, `daily`, `office` (учреждения), `free`.\n- `count` — сколько карточек нужно в режиме `topic`.\n- `words` — только для `complete`: её слова или выражения (обычно немецкие,\n  иногда с переводом через « — »).\n- `exclude` — термины, которые уже есть в наборе. Их не повторять.\n\n## Выход\n\nСтрого JSON по заданной схеме.\n\n## Правила\n\n**Что такое хорошая карточка.**\n- **Связки, а не голые слова.** Глагол даётся в типичном сочетании:\n  `einen Antrag stellen`, `sich um etw. kümmern`, `Bescheid geben`.\n  Голое слово — только если оно само по себе частое и однозначное.\n- Существительное — **с артиклем** (`die Frist`), мн. число — в `note_ru`\n  (`мн. die Fristen`).\n- Уровень **B1–C1**, живая речь. Без редких книжных слов и без того, что\n  уже знает каждый A2 (`das Haus`, `machen`, `gut`).\n- Пометку стиля пиши в `note_ru`, только если слово не нейтральное:\n  «разг.» или «офиц.».\n\n**`definition_ru`** — точный русский перевод, 1–5 слов; два-три синонима\nчерез запятую, если без них смысл неясен.\n\n**`example_de`** — одно короткое естественное предложение (до 12 слов),\nв котором `term` стоит в нужной форме. Тема примера — из `context`.\n\n**Режим `topic`:** ровно `count` карточек (или меньше, если тема узкая), без\nповторов друг друга и `exclude`. Самое употребительное — первым.\n\n**Режим `complete`:** ровно по одной карточке на каждый элемент `words`, в\nтом же порядке. `term` — её слово, приведённое в словарную форму (добавь\nартикль к существительному, исправь опечатку). Если она уже дала перевод —\nиспользуй его в `definition_ru`, если он верный.\n\n## Примеры\n\n### Пример 1 — карточки на тему\nВход:\n```json\n{\n  \"mode\": \"topic\",\n  \"topic\": \"Ausländerbehörde: Aufenthaltstitel verlängern\",\n  \"context\": \"office\",\n  \"count\": 3,\n  \"words\": [],\n  \"exclude\": [\"der Termin\"]\n}\n```\nВыход:\n```json\n{\n  \"cards\": [\n    {\"term\": \"einen Antrag stellen\", \"definition_ru\": \"подать заявление\", \"example_de\": \"Ich habe den Antrag letzte Woche online gestellt.\", \"note_ru\": \"мн. die Anträge\"},\n    {\"term\": \"die Aufenthaltserlaubnis verlängern\", \"definition_ru\": \"продлить вид на жительство\", \"example_de\": \"Meine Aufenthaltserlaubnis muss bis März verlängert werden.\", \"note_ru\": \"офиц.\"},\n    {\"term\": \"Unterlagen nachreichen\", \"definition_ru\": \"донести документы\", \"example_de\": \"Kann ich die fehlenden Unterlagen nächste Woche nachreichen?\", \"note_ru\": \"die Unterlagen — только мн.\"}\n  ]\n}\n```\n\n### Пример 2 — дополнить её слова\nВход:\n```json\n{\n  \"mode\": \"complete\",\n  \"topic\": \"Meetings\",\n  \"context\": \"work\",\n  \"count\": 2,\n  \"words\": [\"Besprechung\", \"sich abstimmen — согласовывать\"],\n  \"exclude\": []\n}\n```\nВыход:\n```json\n{\n  \"cards\": [\n    {\"term\": \"die Besprechung\", \"definition_ru\": \"совещание, обсуждение\", \"example_de\": \"Die Besprechung wurde auf Donnerstag verschoben.\", \"note_ru\": \"мн. die Besprechungen\"},\n    {\"term\": \"sich (mit jdm.) abstimmen\", \"definition_ru\": \"согласовывать\", \"example_de\": \"Ich stimme mich kurz mit dem Team ab und melde mich.\", \"note_ru\": \"sich über etw. abstimmen — о чём\"}\n  ]\n}\n```\n";

export const ANALYZE_SCHEMA = {
  "type": "object",
  "additionalProperties": false,
  "required": [
    "is_german",
    "corrected_sentence",
    "grammar_notes",
    "suggestions",
    "keep",
    "improved_sentence",
    "generic_words"
  ],
  "properties": {
    "is_german": {
      "type": "boolean",
      "description": "false, если текст не на немецком или слишком обрывочный для анализа."
    },
    "corrected_sentence": {
      "type": "string",
      "description": "Фраза с исправленной только грамматикой (слова не меняются). Пустая строка, если ошибок нет."
    },
    "grammar_notes": {
      "type": "array",
      "description": "0–2 самые важные грамматические ошибки.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "original",
          "correction",
          "explanation_ru"
        ],
        "properties": {
          "original": {
            "type": "string",
            "description": "Фрагмент с ошибкой, как в тексте."
          },
          "correction": {
            "type": "string",
            "description": "Исправленный фрагмент."
          },
          "explanation_ru": {
            "type": "string",
            "description": "Правило коротко, по-русски."
          }
        }
      }
    },
    "suggestions": {
      "type": "array",
      "description": "0–3 замены простых слов на более точные и естественные.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "original",
          "replacement",
          "lemma",
          "pattern",
          "meaning_ru",
          "note_ru",
          "register",
          "example_de"
        ],
        "properties": {
          "original": {
            "type": "string",
            "description": "Точная подстрока из transcript (1–4 слова)."
          },
          "replacement": {
            "type": "string",
            "description": "Что встаёт на это место в этой фразе, в нужной форме."
          },
          "lemma": {
            "type": "string",
            "description": "Словарная форма; существительное — с артиклем."
          },
          "pattern": {
            "type": "string",
            "description": "Типичная связка/управление: jdm. etw. vorschlagen."
          },
          "meaning_ru": {
            "type": "string",
            "description": "Перевод, 1–4 слова."
          },
          "note_ru": {
            "type": "string",
            "description": "Когда уместно и чем отличается, до 20 слов."
          },
          "register": {
            "type": "string",
            "enum": [
              "colloquial",
              "neutral",
              "formal"
            ]
          },
          "example_de": {
            "type": "string",
            "description": "Новый короткий пример, до 12 слов."
          }
        }
      }
    },
    "keep": {
      "type": "array",
      "description": "0–2 простых слова из фразы, которые здесь лучше оставить.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "word",
          "reason_ru"
        ],
        "properties": {
          "word": {
            "type": "string",
            "description": "Слово как в тексте."
          },
          "reason_ru": {
            "type": "string",
            "description": "Почему замена не нужна."
          }
        }
      }
    },
    "improved_sentence": {
      "type": "string",
      "description": "Фраза со всеми заменами и исправлениями. Без замен и ошибок — исходный текст."
    },
    "generic_words": {
      "type": "array",
      "description": "Леммы из списка слабых слов, встреченные в тексте, по порядку, без повторов.",
      "items": {
        "type": "string"
      }
    }
  }
} as const;

export const EVALUATE_SCHEMA = {
  "type": "object",
  "additionalProperties": false,
  "required": [
    "meaning_preserved",
    "targets",
    "naturalness",
    "errors",
    "better_version",
    "feedback_ru"
  ],
  "properties": {
    "meaning_preserved": {
      "type": "boolean",
      "description": "rephrase: смысл исходной фразы сохранён. transfer: предложение осмысленное и по теме."
    },
    "targets": {
      "type": "array",
      "description": "Ровно по одному элементу на каждую цель из запроса, те же id, тот же порядок.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "id",
          "used",
          "correct",
          "comment_ru"
        ],
        "properties": {
          "id": {
            "type": "string"
          },
          "used": {
            "type": "boolean",
            "description": "Лемма цели есть в ответе в задуманной функции."
          },
          "correct": {
            "type": "boolean",
            "description": "Употреблена грамматически и по смыслу верно. При used=false всегда false."
          },
          "comment_ru": {
            "type": "string",
            "description": "Коротко по этой цели; пустая строка, если нечего сказать."
          }
        }
      }
    },
    "naturalness": {
      "type": "string",
      "enum": [
        "natural",
        "understandable",
        "unnatural"
      ]
    },
    "errors": {
      "type": "array",
      "description": "0–3 реальные ошибки в ответе (не пунктуация и не регистр букв).",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "fragment",
          "correction",
          "explanation_ru"
        ],
        "properties": {
          "fragment": {
            "type": "string"
          },
          "correction": {
            "type": "string"
          },
          "explanation_ru": {
            "type": "string"
          }
        }
      }
    },
    "better_version": {
      "type": "string",
      "description": "Ближайшая к ответу естественная версия, где все цели употреблены правильно."
    },
    "feedback_ru": {
      "type": "string",
      "description": "1–2 конкретных предложения: что получилось и что исправить."
    }
  }
} as const;

export const CARDS_SCHEMA = {
  "type": "object",
  "additionalProperties": false,
  "required": [
    "cards"
  ],
  "properties": {
    "cards": {
      "type": "array",
      "description": "topic: до count новых карточек по теме. complete: ровно по одной на каждое слово из words, в том же порядке.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "term",
          "definition_ru",
          "example_de",
          "note_ru"
        ],
        "properties": {
          "term": {
            "type": "string",
            "description": "Немецкий: существительное с артиклем, глагол — в типичной связке (einen Antrag stellen)."
          },
          "definition_ru": {
            "type": "string",
            "description": "Перевод, 1–5 слов; синонимы через запятую."
          },
          "example_de": {
            "type": "string",
            "description": "Короткое живое предложение с term (до 12 слов)."
          },
          "note_ru": {
            "type": "string",
            "description": "Мн. число, управление или стиль — коротко; пустая строка, если нечего добавить."
          }
        }
      }
    }
  }
} as const;

export const ANALYZE_SCHEMA_FULL = {
  "title": "AnalyzeResponse",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "is_german",
    "corrected_sentence",
    "grammar_notes",
    "suggestions",
    "keep",
    "improved_sentence",
    "generic_words"
  ],
  "properties": {
    "is_german": {
      "type": "boolean",
      "description": "false, если текст не на немецком или слишком обрывочный для анализа."
    },
    "corrected_sentence": {
      "type": "string",
      "description": "Фраза с исправленной только грамматикой (слова не меняются). Пустая строка, если ошибок нет."
    },
    "grammar_notes": {
      "type": "array",
      "description": "0–2 самые важные грамматические ошибки.",
      "items": {
        "title": "GrammarNote",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "original",
          "correction",
          "explanation_ru"
        ],
        "properties": {
          "original": {
            "type": "string",
            "description": "Фрагмент с ошибкой, как в тексте."
          },
          "correction": {
            "type": "string",
            "description": "Исправленный фрагмент."
          },
          "explanation_ru": {
            "type": "string",
            "description": "Правило коротко, по-русски."
          }
        }
      }
    },
    "suggestions": {
      "type": "array",
      "description": "0–3 замены простых слов на более точные и естественные.",
      "items": {
        "title": "Suggestion",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "original",
          "replacement",
          "lemma",
          "pattern",
          "meaning_ru",
          "note_ru",
          "register",
          "example_de"
        ],
        "properties": {
          "original": {
            "type": "string",
            "description": "Точная подстрока из transcript (1–4 слова)."
          },
          "replacement": {
            "type": "string",
            "description": "Что встаёт на это место в этой фразе, в нужной форме."
          },
          "lemma": {
            "type": "string",
            "description": "Словарная форма; существительное — с артиклем."
          },
          "pattern": {
            "type": "string",
            "description": "Типичная связка/управление: jdm. etw. vorschlagen."
          },
          "meaning_ru": {
            "type": "string",
            "description": "Перевод, 1–4 слова."
          },
          "note_ru": {
            "type": "string",
            "description": "Когда уместно и чем отличается, до 20 слов."
          },
          "register": {
            "type": "string",
            "enum": [
              "colloquial",
              "neutral",
              "formal"
            ]
          },
          "example_de": {
            "type": "string",
            "description": "Новый короткий пример, до 12 слов."
          }
        }
      }
    },
    "keep": {
      "type": "array",
      "description": "0–2 простых слова из фразы, которые здесь лучше оставить.",
      "items": {
        "title": "KeepNote",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "word",
          "reason_ru"
        ],
        "properties": {
          "word": {
            "type": "string",
            "description": "Слово как в тексте."
          },
          "reason_ru": {
            "type": "string",
            "description": "Почему замена не нужна."
          }
        }
      }
    },
    "improved_sentence": {
      "type": "string",
      "description": "Фраза со всеми заменами и исправлениями. Без замен и ошибок — исходный текст."
    },
    "generic_words": {
      "type": "array",
      "description": "Леммы из списка слабых слов, встреченные в тексте, по порядку, без повторов.",
      "items": {
        "type": "string"
      }
    }
  }
} as const;

export const EVALUATE_SCHEMA_FULL = {
  "title": "EvaluateResponse",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "meaning_preserved",
    "targets",
    "naturalness",
    "errors",
    "better_version",
    "feedback_ru"
  ],
  "properties": {
    "meaning_preserved": {
      "type": "boolean",
      "description": "rephrase: смысл исходной фразы сохранён. transfer: предложение осмысленное и по теме."
    },
    "targets": {
      "type": "array",
      "description": "Ровно по одному элементу на каждую цель из запроса, те же id, тот же порядок.",
      "items": {
        "title": "TargetResult",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "id",
          "used",
          "correct",
          "comment_ru"
        ],
        "properties": {
          "id": {
            "type": "string"
          },
          "used": {
            "type": "boolean",
            "description": "Лемма цели есть в ответе в задуманной функции."
          },
          "correct": {
            "type": "boolean",
            "description": "Употреблена грамматически и по смыслу верно. При used=false всегда false."
          },
          "comment_ru": {
            "type": "string",
            "description": "Коротко по этой цели; пустая строка, если нечего сказать."
          }
        }
      }
    },
    "naturalness": {
      "type": "string",
      "enum": [
        "natural",
        "understandable",
        "unnatural"
      ]
    },
    "errors": {
      "type": "array",
      "description": "0–3 реальные ошибки в ответе (не пунктуация и не регистр букв).",
      "items": {
        "title": "AnswerError",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "fragment",
          "correction",
          "explanation_ru"
        ],
        "properties": {
          "fragment": {
            "type": "string"
          },
          "correction": {
            "type": "string"
          },
          "explanation_ru": {
            "type": "string"
          }
        }
      }
    },
    "better_version": {
      "type": "string",
      "description": "Ближайшая к ответу естественная версия, где все цели употреблены правильно."
    },
    "feedback_ru": {
      "type": "string",
      "description": "1–2 конкретных предложения: что получилось и что исправить."
    }
  }
} as const;

export const CARDS_SCHEMA_FULL = {
  "title": "CardsResponse",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "cards"
  ],
  "properties": {
    "cards": {
      "type": "array",
      "description": "topic: до count новых карточек по теме. complete: ровно по одной на каждое слово из words, в том же порядке.",
      "items": {
        "title": "GeneratedCard",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "term",
          "definition_ru",
          "example_de",
          "note_ru"
        ],
        "properties": {
          "term": {
            "type": "string",
            "description": "Немецкий: существительное с артиклем, глагол — в типичной связке (einen Antrag stellen)."
          },
          "definition_ru": {
            "type": "string",
            "description": "Перевод, 1–5 слов; синонимы через запятую."
          },
          "example_de": {
            "type": "string",
            "description": "Короткое живое предложение с term (до 12 слов)."
          },
          "note_ru": {
            "type": "string",
            "description": "Мн. число, управление или стиль — коротко; пустая строка, если нечего добавить."
          }
        }
      }
    }
  }
} as const;
