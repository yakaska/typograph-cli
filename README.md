# typograph-cli

CLI и библиотека для типографики русского текста: ёфикатор, кавычки
(«ёлочки»/„лапки“), тире (длинное/среднее/дефис), пунктуация, лишние пробелы,
числа и валюта (₽, $, €, копейки), телефонные номера, неразрывные пробелы,
строчные буквы, прочее (Visa, Mastercard, Wi-Fi, ПИН-код, QR-код, СМС и т.д.).

Особенность: умеет аккуратно обрабатывать **FreeMarker-шаблоны, которые
рендерятся в JSON** — меняет только текстовые поля, не трогая `${...}`,
`<#if>`/`<#list>`/`<#macro>`, ключи и структуру.

## Стек и требования

- **Node.js >= 18** (ESM, `node:test`).
- Внешних зависимостей **нет** (только встроенные модули `fs`, `path`, `url`).
- Установка не требует `npm install`.

## Установка

```bash
git clone <этот-репозиторий> typograph-cli
cd typograph-cli
npm link            # опционально: добавляет команду typograph в PATH
```

Без `npm link` можно запускать напрямую:

```bash
node bin/typograph.js [опции] [файлы...]
```

## Запуск

```text
typograph [опции] [файлы...]
```

Вход: файлы, glob-паттерны или stdin (когда файлы не переданы или указан `-`).
Выход: обработанный текст в stdout, счётчики по категориям — в stderr.

### Режимы

| `--mode` | Что делает |
|----------|-----------|
| `text` (по умолчанию) | Типографирует обычный текстовый файл целиком |
| `ftl-json` | Обрабатывает только текстовые поля JSON-тела внутри FreeMarker-шаблона |

### Опции

| Флаг | Описание |
|------|----------|
| `--mode text\|ftl-json` | режим обработки (по умолчанию `text`) |
| `--write`, `-w` | записать результат обратно в файл |
| `--check` | выйти с кодом `1`, если файл изменился бы (без записи) |
| `--diff` | вывести unified diff вместо полного результата |
| `--fields a,b,c` | ftl-json: белый список обрабатываемых полей |
| `--exclude-fields x,y` | ftl-json: чёрный список полей |
| `--ftl-strings` | ftl-json: также типографировать русские литералы в `<#assign>`/`<#return>` |
| `--help`, `-h` | справка |
| `--version`, `-v` | версия |

## Примеры использования

### 1. Обычный текст

```bash
# из файла — в stdout
typograph text.txt

# несколько файлов и glob
typograph "docs/**/*.txt"

# из stdin (echo или пайп)
echo "зеленый ежик. 789 руб." | typograph

# записать на месте (сохраняет LF/CRLF и финальный перевод строки)
typograph --write text.txt
```

До/после:

```text
зеленый ежик. 789 руб.          →  зелёный ёжик. 789 ₽
"кавычки" - это тире             →  «кавычки» — это тире
8 800 555 55 50                  →  8 (800) 555-55-50
```

### 2. FreeMarker-шаблон с JSON

```bash
# показать, что изменится
typograph --mode ftl-json --diff page.ftl

# проверить без записи (exit 1 = изменения есть)
typograph --mode ftl-json --check page.ftl

# применить на месте
typograph --mode ftl-json --write page.ftl
```

Вход:

```json
{
  "title": "Сумма ${amount} руб.",
  "subtitle": "${productName} ·· ${cardNumber}",
  "uri": "https://example.com/person/credits"
}
```

Выход (меняются только `title`/`subtitle`; `uri` и `${...}` не тронуты):

```json
{
  "title": "Сумма ${amount} ₽",
  "subtitle": "${productName} ·· ${cardNumber}",
  "uri": "https://example.com/person/credits"
}
```

NBSP в примерах показаны как обычные пробелы — в файле это реальные символы
`\u00A0`.

### 3. Выбор полей

```bash
# обрабатывать только title и text
typograph --mode ftl-json --fields title,text --write page.ftl

# дополнительно исключить url
typograph --mode ftl-json --exclude-fields url --write page.ftl
```

Поля по умолчанию:

- **Белый список:** `title`, `subtitle`, `text`, `description`, `label`,
  `message`, `buttonText`.
- **Чёрный список:** `type`, `icon`, `uri`, `url`, `link`, `id`, `toggle`,
  `eventForAnalytic`, `paramsForAnalytic`, `subtitleVoice`, `titleVoice`, а
  также любой ключ с суффиксом `Voice`.

Переопределить значения можно через файл `.typographrc.json` (ищется от
текущей директории вверх):

```json
{
  "fields": ["title", "text"],
  "excludeFields": ["url"],
  "excludeSuffixes": ["Voice"]
}
```

### 4. Что делает `ftl-json` под капотом

- FreeMarker-токены (`${...}`, `#{...}`, `<#...>`, `</#...>`, `<@...>`,
  `</@...>`, `<#-- ... -->`) считаются непрозрачными и никогда не меняются.
- JSON **не парсится** (шаблон до рендера не является валидным JSON).
- Находятся строки JSON-тела, сопоставляются парам `"ключ": "значение"`.
- Значение обрабатывается, только если ключ в белом списке и не в чёрном.
- Внутри значения `${...}` заменяется на плейсхолдеры, прогоняется типограф,
  затем вставки возвращаются. Внешние кавычки не трогаются; внутренние
  `\"...\"` становятся «...».
- Всё вне текстовых значений (отступы, порядок ключей, комментарии, код
  директив) сохраняется побайтно.

## Тесты

```bash
npm test
```

Запускает встроенный раннер Node (`node --test`): тесты ядра (примеры из
README + идемпотентность) и тесты ftl-json-режима (fixtures в
`tests/fixtures/`).

```bash
# отдельный файл тестов
node --test tests/typograph.test.js
node --test tests/ftl-json.test.js
```

## Сборка бандла для Skill

Skill лежит в `skill/typograph/`. Бандл — один JS-файл
(`skill/typograph/scripts/typograph.js`) + файлы данных, без `npm install`.
Пересобрать после изменения `src/`:

```bash
npm run build:bundle
```

## Agent Skill

Установка в директорию скиллов агента (для Claude Code: `~/.claude/skills/`
или `.claude/skills/`):

```bash
cp -r skill/typograph ~/.claude/skills/
```

Пример для `CLAUDE.md` / `AGENTS.md`:

```markdown
## Типографика

- Русские UI-тексты, баннеры и `.ftl`-шаблоны ОБЯЗАТЕЛЬНО прогонять через
  typograph. Не править типографику вручную.
- Команда: `typograph --mode ftl-json --write <file>`
- Не запускать на нетекстовых файлах.
```

Пример Claude Code hook (`PostToolUse` для `*.ftl`):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "for f in $(git diff --name-only -- '*.ftl'); do typograph --mode ftl-json --write \"$f\"; done"
          }
        ]
      }
    ]
  }
}
```

## Переменные окружения

Проект не использует переменные окружения.

## Структура проекта

```text
bin/typograph.js                 точка входа CLI
src/cli.js                       разбор аргументов, режимы, diff/check
src/config.js                    конфигурация полей (белый/чёрный список)
src/typograph.js                 ядро правил типографики
src/ftl-json.js                  обработка FreeMarker/JSON-шаблонов
data/                            словари (ёфикация, телефоны, NBSP и т.д.)
scripts/build-bundle.mjs         сборка однофайлового бандла для skill
skill/typograph/                 agent skill (SKILL.md + бандл)
tests/                           тесты и fixtures
```
