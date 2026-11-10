---
name: typograph
description: Apply Russian typography rules (ёфикатор, кавычки, тире, неразрывные пробелы, валюта, телефоны) to Russian UI texts, banners, and FreeMarker (.ftl) templates that render to JSON. Use when editing or fixing Russian user-facing strings, notifications, or .ftl files with textual fields, or when a typography pass is needed on text content.
---

# Typograph

Applies Russian editorial-policy typography rules to Russian text. Never edit
typography by hand — run the tool instead.

## When to use

- Editing or adding Russian UI texts, banners, titles, subtitles, labels,
  buttons, messages.
- Working with `.ftl` (FreeMarker) templates whose JSON body contains textual
  fields.
- Normalising text that should follow the typography rules (ёфикатор,
  «ёлочки»/„лапки“, длинное/среднее тире, неразрывные пробелы, валюта,
  телефонные номера).

## How to run

For a FreeMarker/JSON template (the common case), write the result back
in place:

```bash
typograph --mode ftl-json --write <file>
```

`--mode ftl-json` only edits textual field values (`title`, `subtitle`, `text`,
`description`, `label`, `message`, `buttonText` by default). Keys like `uri`,
`url`, `icon`, `type`, `id`, `*Voice`, `${...}` interpolations, and everything
outside string values are left byte-for-byte unchanged.

Other useful forms:

```bash
typograph --mode ftl-json --check <file>    # exit 1 if the file would change
typograph --mode ftl-json --diff <file>     # show a unified diff
typograph --mode text --write <file>        # plain text file
typograph --fields title,text --exclude-fields url <file>
typograph --mode ftl-json --ftl-strings <file>
```

The bundled CLI is a single file at `scripts/typograph.js` (no `npm install`
required; run it with `node scripts/typograph.js ...`). If the `typograph`
command is not on `PATH`, use the `node` form.

## What not to do

- Do NOT fix typography by hand — always run the tool.
- Do NOT run it on non-text files (images, binaries, minified assets).
- Do NOT edit `scripts/` — it is a generated bundle; regenerate it from the
  source project instead.
- Do NOT add new typography rules without agreement; the rule set is fixed.

## How it works (summary)

- FreeMarker tokens (`${...}`, `#{...}`, `<#...>`, `</#...>`, `<@...>`,
  `</@...>`, `<#-- ... -->`) are treated as opaque and never changed.
- JSON string values are matched to their keys; only whitelisted textual keys
  are processed. The template is never `JSON.parse`d (it is not valid JSON
  before rendering).
- Inside a value, FreeMarker tokens are protected with Private Use Area
  placeholders, JSON escapes are un-escaped, the typography pass runs, then
  tokens are restored and escapes re-applied. Outer quotes are untouched;
  inner `\"...\"` become «...».
