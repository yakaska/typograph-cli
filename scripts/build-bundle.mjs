// Build script: bundle the ESM source into a single-file CLI for the skill
// (no npm install required at runtime). Relative imports are inlined; only
// node: built-ins remain as imports. `data/*.txt` is copied alongside.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const entry = path.join(root, 'src', 'cli.js');
const outDir = path.join(root, 'skill', 'typograph', 'scripts');
const outFile = path.join(outDir, 'typograph.js');

const seen = new Set();
const nodeImports = [];
const bodies = [];

function resolveModule(file) {
  const abs = path.resolve(file);
  if (seen.has(abs)) return;
  seen.add(abs);

  const src = fs.readFileSync(abs, 'utf8');
  const lines = src.split('\n');
  const deps = [];
  const outLines = [];

  for (const line of lines) {
    const m = line.match(/^import\s+(.+?)\s+from\s+['"](.+?)['"];?\s*$/);
    if (m) {
      const specifier = m[2];
      if (specifier.startsWith('node:')) {
        const stmt = line.trim();
        if (!nodeImports.includes(stmt)) nodeImports.push(stmt);
      } else {
        deps.push(path.resolve(path.dirname(abs), specifier));
      }
      continue;
    }
    outLines.push(line);
  }

  for (const d of deps) resolveModule(d);

  const body = outLines
    .map((l) => l.replace(/^export\s+(const|function|let|var|class)\s+/, '$1 '))
    .filter((l) => !/^export\s+default\s+/.test(l))
    .join('\n');
  bodies.push(body);
}

resolveModule(entry);

const shebang = '#!/usr/bin/env node\n';
const output =
  shebang +
  nodeImports.join('\n') +
  '\n\n' +
  bodies.join('\n\n') +
  '\n\nprocess.exitCode = main(process.argv.slice(2));\n';

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, output, 'utf8');

const dataSrc = path.join(root, 'data');
const dataDst = path.join(outDir, 'data');
fs.mkdirSync(dataDst, { recursive: true });
for (const f of fs.readdirSync(dataSrc)) {
  fs.copyFileSync(path.join(dataSrc, f), path.join(dataDst, f));
}

console.log('bundle written to', outFile);
