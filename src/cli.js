// CLI for typograph.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { typograph } from './typograph.js';
import { processFtlJson } from './ftl-json.js';
import { resolveConfig } from './config.js';

const STAT_LABELS = [
  ['punctuation', 'Знаков пунктуации исправлено'],
  ['deleteSpaces', 'Лишних пробелов удалено'],
  ['removeEndDotInSingleString', 'Точек в заголовках удалено'],
  ['replaceQuoteMarks', 'Кавычек заменено'],
  ['addNoBreakSpace', 'Неразрывных пробелов проставлено'],
  ['dash', 'Тире заменено'],
  ['replaceDotWithComma', 'Точек в числах заменено'],
  ['rub', 'Знаков рубля проставлено'],
  ['currency', 'Знаков валюты исправлено'],
  ['phoneNumber', 'Телефонных номеров исправлено'],
  ['lowerCase', 'Слов в нижний регистр переведено'],
  ['YO', 'Е на Ё заменено'],
  ['other', 'Разное'],
];

function usage() {
  return `Usage: typograph [options] [files...]

Process text or FreeMarker/JSON templates with typography rules.
Reads from files, globs, or stdin (when no files given or "-").

Options:
  --mode <text|ftl-json>   processing mode (default: text)
  --write, -w              write result back to files in place
  --check                  exit code 1 if any file would change (no write)
  --diff                   print a unified diff instead of the full result
  --fields <a,b,c>         (ftl-json) comma-separated whitelist of fields
  --exclude-fields <x,y>   (ftl-json) comma-separated blacklist of fields
  --ftl-strings            (ftl-json) also process Russian literals in
                           <#assign>/<#return> (default: off)
  --help, -h               show this help
  --version, -v            show version
`;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function globToRegExp(pattern) {
  const parts = [];
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/' || pattern[i + 2] === '\\') {
          parts.push('(?:[^/\\\\]+[\\\\/])*');
          i += 2;
        } else {
          parts.push('.*');
          i += 1;
        }
      } else {
        parts.push('[^/\\\\]*');
      }
    } else if (c === '?') {
      parts.push('[^/\\\\]');
    } else if (c === '/' || c === '\\') {
      parts.push('[\\\\/]');
    } else {
      parts.push(escapeRegExp(c));
    }
  }
  return new RegExp('^' + parts.join('') + '$');
}

function expandGlob(pattern, cwd) {
  if (!/[*?]/.test(pattern)) {
    const p = path.resolve(cwd, pattern);
    return fs.existsSync(p) ? [p] : [];
  }
  const norm = pattern.split(path.sep).join('/');
  const re = globToRegExp(norm);
  const wildIdx = norm.search(/[*?]/);
  const base = wildIdx === -1 ? norm : norm.slice(0, wildIdx);
  const slash = base.lastIndexOf('/');
  const baseDir = slash === -1 ? '.' : base.slice(0, slash) || '/';
  const absBaseDir = path.resolve(cwd, baseDir);
  if (!fs.existsSync(absBaseDir)) return [];

  const results = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      const rel = path.relative(cwd, full).split(path.sep).join('/');
      const abs = full.split(path.sep).join('/');
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.isFile()) {
        if (re.test(rel) || re.test(abs)) results.push(full);
      }
    }
  };
  walk(absBaseDir);
  return results;
}

export function parseArgs(argv) {
  const opts = {
    mode: 'text',
    write: false,
    check: false,
    diff: false,
    ftlStrings: false,
    fields: null,
    excludeFields: null,
    help: false,
    version: false,
    files: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--mode':
        opts.mode = argv[++i] || 'text';
        break;
      case '--write':
      case '-w':
        opts.write = true;
        break;
      case '--check':
        opts.check = true;
        break;
      case '--diff':
        opts.diff = true;
        break;
      case '--ftl-strings':
        opts.ftlStrings = true;
        break;
      case '--fields':
        opts.fields = argv[++i] || '';
        break;
      case '--exclude-fields':
        opts.excludeFields = argv[++i] || '';
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      case '--version':
      case '-v':
        opts.version = true;
        break;
      default:
        if (a.startsWith('-') && a !== '-') {
          throw new Error(`unknown option: ${a}`);
        }
        opts.files.push(a);
    }
  }
  return opts;
}

function processTextPreservingWs(content, stats) {
  const lead = content.match(/^[\s]*/)[0];
  const trail = content.match(/[\s]*$/)[0];
  const core = content.slice(lead.length, content.length - trail.length);
  const out = typograph(core, { stats });
  return lead + out + trail;
}

function processContent(content, opts, config) {
  if (opts.mode === 'ftl-json') {
    const stats = {};
    const { output, warnings } = processFtlJson(content, {
      config,
      ftlStrings: opts.ftlStrings,
      stats,
    });
    return { output, warnings, stats };
  }
  const stats = {};
  const output = processTextPreservingWs(content, stats);
  return { output, warnings: [], stats };
}

function formatStats(stats) {
  if (!stats) return '';
  const lines = [];
  for (const [key, label] of STAT_LABELS) {
    if (stats[key] > 0) lines.push(`${label}: ${stats[key]}`);
  }
  return lines.length ? lines.join('\n') : 'Ничего не исправлено';
}

function unifiedDiff(a, b) {
  const al = a.split('\n');
  const bl = b.split('\n');
  const n = Math.max(al.length, bl.length);
  const changed = [];
  for (let i = 0; i < n; i++) {
    if (al[i] !== bl[i]) changed.push(i);
  }
  if (changed.length === 0) return '';

  const ctx = 3;
  const from = Math.max(0, changed[0] - ctx);
  const to = Math.min(n, changed[changed.length - 1] + ctx + 1);
  const lines = [`@@ -${from + 1},${to - from} +${from + 1},${to - from} @@`];
  for (let i = from; i < to; i++) {
    const aLine = al[i];
    const bLine = bl[i];
    if (aLine === bLine) {
      lines.push(' ' + aLine);
    } else {
      if (i < al.length) lines.push('-' + aLine);
      if (i < bl.length) lines.push('+' + bLine);
    }
  }
  return lines.join('\n');
}

export function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`typograph: ${e.message}\n`);
    return 2;
  }

  if (opts.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (opts.version) {
    const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    let version = 'unknown';
    try {
      version = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
    } catch {
      /* ignore */
    }
    process.stdout.write(version + '\n');
    return 0;
  }

  if (opts.mode !== 'text' && opts.mode !== 'ftl-json') {
    process.stderr.write(`typograph: invalid --mode: ${opts.mode}\n`);
    return 2;
  }

  const config = resolveConfig({
    fields: opts.fields,
    excludeFields: opts.excludeFields,
    cwd: process.cwd(),
  });

  // Resolve inputs
  const cwd = process.cwd();
  let files = [];
  for (const pattern of opts.files) {
    if (pattern === '-') continue;
    files.push(...expandGlob(pattern, cwd));
  }
  const useStdin = opts.files.length === 0 || (opts.files.length === 1 && opts.files[0] === '-');

  const aggregate = {};
  let changed = 0;

  const handleInput = (name, content, writeTarget) => {
    const { output, warnings, stats } = processContent(content, opts, config);
    for (const w of warnings) {
      process.stderr.write(`${name}: ${w}\n`);
    }
    if (stats) {
      for (const k in stats) aggregate[k] = (aggregate[k] || 0) + stats[k];
    }
    const isChanged = output !== content;
    if (isChanged) changed++;

    if (opts.check) {
      if (isChanged) process.stderr.write(`${name}\n`);
      return;
    }
    if (opts.diff) {
      const d = unifiedDiff(content, output);
      if (d) {
        process.stdout.write(`--- ${name}\n+++ ${name}\n${d}\n`);
      }
      return;
    }
    if (opts.write) {
      if (writeTarget) {
        fs.writeFileSync(writeTarget, output, 'utf8');
      } else {
        process.stdout.write(output);
      }
      return;
    }
    process.stdout.write(output);
  };

  if (useStdin) {
    const content = fs.readFileSync(0, 'utf8');
    handleInput('(stdin)', content, null);
  } else {
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      handleInput(file, content, file);
    }
  }

  if (!opts.check && !opts.diff) {
    const summary = formatStats(aggregate);
    if (summary) process.stderr.write(summary + '\n');
  }

  if (opts.check) {
    return changed > 0 ? 1 : 0;
  }
  return 0;
}
