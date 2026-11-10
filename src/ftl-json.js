// ftl-json mode: process textual JSON string values inside a FreeMarker
// template that renders to JSON.
//
// The template is *not* valid JSON before rendering (FreeMarker directives
// interleave with JSON structure), so JSON.parse is never used. Instead we
// lex FreeMarker tokens, then scan JSON string literals in the remaining text.

import { typograph, ATOM_START, ATOM_COUNT } from './typograph.js';
import { shouldProcess } from './config.js';

// ---------------------------------------------------------------------------
// FreeMarker lexer
// ---------------------------------------------------------------------------

/**
 * Tokenize a FreeMarker template into text and opaque FreeMarker tokens.
 *
 * Opaque tokens (never modified): `<#-- ... -->`, `<#...>`, `</#...>`,
 * `<@...>`, `</@...>`, `${...}`, `#{...}`.
 *
 * @returns {{ items: Array<{type:string, value:string, pos:number, kind?:string}>, warnings: string[] }}
 */
export function lexFreeMarker(input) {
  const items = [];
  const warnings = [];
  const n = input.length;
  let i = 0;
  let textStart = 0;

  const pushText = (end) => {
    if (end > textStart) {
      items.push({ type: 'text', value: input.slice(textStart, end), pos: textStart });
    }
  };

  const warn = (pos, reason) => {
    const line = input.slice(0, pos).split('\n').length;
    warnings.push(`line ${line}: ${reason}`);
  };

  while (i < n) {
    if (input.startsWith('<#--', i)) {
      const end = input.indexOf('-->', i + 4);
      if (end === -1) {
        warn(i, 'unterminated FreeMarker comment');
        break;
      }
      pushText(i);
      items.push({ type: 'token', value: input.slice(i, end + 3), pos: i, kind: 'comment' });
      i = end + 3;
      textStart = i;
      continue;
    }

    if (input.startsWith('</#', i) || input.startsWith('</@', i) ||
        input.startsWith('<#', i) || input.startsWith('<@', i)) {
      const end = scanDirective(input, i);
      if (end === -1) {
        warn(i, 'unterminated FreeMarker directive');
        break;
      }
      pushText(i);
      items.push({ type: 'token', value: input.slice(i, end + 1), pos: i, kind: 'directive' });
      i = end + 1;
      textStart = i;
      continue;
    }

    if (input.startsWith('${', i) || input.startsWith('#{', i)) {
      const end = scanInterpolation(input, i);
      if (end === -1) {
        warn(i, 'unterminated FreeMarker interpolation');
        break;
      }
      pushText(i);
      items.push({ type: 'token', value: input.slice(i, end + 1), pos: i, kind: 'interpolation' });
      i = end + 1;
      textStart = i;
      continue;
    }

    i++;
  }

  pushText(n);
  return { items, warnings };
}

function scanDirective(input, start) {
  let depth = 0;
  let quote = null;
  for (let i = start + 2; i < input.length; i++) {
    const c = input[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; continue; }
    if (c === ')' || c === ']' || c === '}') { if (depth > 0) depth--; continue; }
    if (c === '>' && depth === 0) return i;
  }
  return -1;
}

function scanInterpolation(input, start) {
  let depth = 0;
  let quote = null;
  for (let i = start + 2; i < input.length; i++) {
    const c = input[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '{') { depth++; continue; }
    if (c === '}') {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// JSON string escaping
// ---------------------------------------------------------------------------

export function unescapeJson(s) {
  return s.replace(/\\(["\\/bfnrt]|u[0-9a-fA-F]{4})/g, (m, esc) => {
    switch (esc) {
      case '"': return '"';
      case '\\': return '\\';
      case '/': return '/';
      case 'b': return '\b';
      case 'f': return '\f';
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      default: return String.fromCharCode(parseInt(esc.slice(1), 16));
    }
  });
}

function escapeJsonChar(ch) {
  switch (ch) {
    case '"': return '\\"';
    case '\\': return '\\\\';
    case '\b': return '\\b';
    case '\f': return '\\f';
    case '\n': return '\\n';
    case '\r': return '\\r';
    case '\t': return '\\t';
    default: {
      const code = ch.codePointAt(0);
      if (code < 0x20) return '\\u' + code.toString(16).padStart(4, '0');
      return ch;
    }
  }
}

// FreeMarker string literal escapes (used by --ftl-strings).
function unescapeFtl(s) {
  return s.replace(/\\(["'\\nrtbf])/g, (m, esc) => {
    switch (esc) {
      case '"': return '"';
      case "'": return "'";
      case '\\': return '\\';
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case 'b': return '\b';
      case 'f': return '\f';
      default: return esc;
    }
  });
}

function escapeFtlChar(ch) {
  switch (ch) {
    case '"': return '\\"';
    case '\\': return '\\\\';
    case '\n': return '\\n';
    case '\r': return '\\r';
    case '\t': return '\\t';
    default: return ch;
  }
}

// ---------------------------------------------------------------------------
// Value processing
// ---------------------------------------------------------------------------

function isEntirelyTokens(items) {
  for (const item of items) {
    if (item.type === 'text' && item.value.trim() !== '') return false;
  }
  return true;
}

function processValueInner(raw, warnings, stats) {
  const { items } = lexFreeMarker(raw);
  if (isEntirelyTokens(items)) return raw;

  const tokenMap = new Map();
  let out = '';
  let idx = 0;
  for (const item of items) {
    if (item.type === 'token') {
      if (idx >= ATOM_COUNT) {
        // Too many tokens for the PUA range: leave value untouched.
        warnings.push('too many FreeMarker tokens in a single value');
        return raw;
      }
      const ph = String.fromCodePoint(ATOM_START + idx);
      tokenMap.set(ph, item.value);
      idx++;
      out += ph;
    } else {
      out += unescapeJson(item.value);
    }
  }

  const typographed = typograph(out, { stats });

  let result = '';
  for (let k = 0; k < typographed.length; k++) {
    const ch = typographed[k];
    const tok = tokenMap.get(ch);
    if (tok !== undefined) {
      result += tok;
    } else {
      result += escapeJsonChar(ch);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// JSON string scanner
// ---------------------------------------------------------------------------

function flatten(items) {
  const units = [];
  for (const item of items) {
    if (item.type === 'text') {
      for (let k = 0; k < item.value.length; k++) {
        units.push({ c: item.value[k], p: item.pos + k });
      }
    } else {
      units.push({ tk: item.value, p: item.pos });
    }
  }
  return units;
}

function peekStructural(units, from) {
  for (let k = from; k < units.length; k++) {
    const u = units[k];
    if (u.tk !== undefined) continue;
    if (u.c === ' ' || u.c === '\t' || u.c === '\r' || u.c === '\n') continue;
    return u.c;
  }
  return null;
}

function scanString(units, i) {
  const qOpen = units[i].p;
  for (let j = i + 1; j < units.length; j++) {
    const u = units[j];
    if (u.tk !== undefined) continue;
    if (u.c === '\\') { j++; continue; }
    if (u.c === '"') {
      const qClose = u.p;
      return { unterminated: false, qOpen, qClose, nextIndex: j + 1 };
    }
  }
  return { unterminated: true, qOpen, nextIndex: units.length };
}

// ---------------------------------------------------------------------------
// --ftl-strings: Russian string literals inside <#assign>/<#return>
// ---------------------------------------------------------------------------

function findFtlStringLiterals(body) {
  const found = [];
  let i = 0;
  while (i < body.length) {
    if (body[i] === '"' || body[i] === "'") {
      const quote = body[i];
      let j = i + 1;
      let raw = '';
      let closed = false;
      while (j < body.length) {
        const c = body[j];
        if (c === '\\') { raw += c + (body[j + 1] || ''); j += 2; continue; }
        if (c === quote) { closed = true; break; }
        raw += c;
        j++;
      }
      if (closed) {
        found.push({ start: i, end: j + 1, raw });
        i = j + 1;
      } else {
        i = j;
      }
    } else {
      i++;
    }
  }
  return found;
}

function isConcatenation(body, lit) {
  const before = body.slice(0, lit.start).trimEnd();
  const after = body.slice(lit.end).trimStart();
  return before.endsWith('+') || after.startsWith('+');
}

function processFtlStrings(input, warnings, stats) {
  const edits = [];
  const { items } = lexFreeMarker(input);
  for (const item of items) {
    if (item.type !== 'token') continue;
    const v = item.value;
    const isAssign = v.startsWith('<#assign');
    const isReturn = v.startsWith('<#return');
    if (!isAssign && !isReturn) continue;

    const body = isAssign ? v.slice('<#assign'.length) : v.slice('<#return'.length);
    const literals = findFtlStringLiterals(body);

    for (const lit of literals) {
      const absStart = item.pos + bodyStartOffset(item, body) + lit.start;
      if (isConcatenation(body, lit)) {
        const line = input.slice(0, absStart).split('\n').length;
        warnings.push(`line ${line}: string literal in <#assign>/<#return> concatenation skipped`);
        continue;
      }
      const unescaped = unescapeFtl(lit.raw);
      if (!/[а-яё]/i.test(unescaped)) continue; // only Russian literals
      const typographed = typograph(unescaped, { stats });
      if (typographed === unescaped) continue;
      let escaped = '';
      for (const ch of typographed) escaped += escapeFtlChar(ch);
      edits.push({ start: absStart + 1, end: absStart + 1 + lit.raw.length, replacement: escaped });
    }
  }
  return edits;
}

function bodyStartOffset(item, body) {
  return item.value.indexOf(body);
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * Process a FreeMarker template (renders to JSON) with typography rules.
 *
 * @param {string} input
 * @param {object} options
 * @param {object} options.config resolved config from src/config.js
 * @param {boolean} [options.ftlStrings] enable --ftl-strings
 * @returns {{ output: string, warnings: string[] }}
 */
export function processFtlJson(input, options = {}) {
  const config = options.config;
  const ftlStrings = !!options.ftlStrings;
  const stats = options.stats || {};
  const warnings = [];

  const { items, warnings: lexWarnings } = lexFreeMarker(input);
  warnings.push(...lexWarnings);

  const units = flatten(items);
  const stack = [];
  const edits = [];

  let i = 0;
  while (i < units.length) {
    const u = units[i];
    if (u.tk !== undefined) { i++; continue; }
    const ch = u.c;

    if (ch === '{') { stack.push({ type: 'object', key: null }); i++; continue; }
    if (ch === '}') { stack.pop(); i++; continue; }
    if (ch === '[') {
      const parent = stack[stack.length - 1];
      const key = parent && parent.type === 'object' ? parent.key : null;
      stack.push({ type: 'array', key });
      i++;
      continue;
    }
    if (ch === ']') { stack.pop(); i++; continue; }
    if (ch === ':' || ch === ',') { i++; continue; }
    if (ch === '"') {
      const str = scanString(units, i);
      if (str.unterminated) {
        const line = input.slice(0, str.qOpen).split('\n').length;
        warnings.push(`line ${line}: unterminated JSON string`);
        i = str.nextIndex;
        continue;
      }
      const raw = input.slice(str.qOpen + 1, str.qClose);
      const next = peekStructural(units, str.nextIndex);
      if (next === ':') {
        // key
        const key = unescapeJson(raw);
        const top = stack[stack.length - 1];
        if (top && top.type === 'object') top.key = key;
      } else {
        // value
        const top = stack[stack.length - 1];
        const key = top ? top.key : null;
        if (key && shouldProcess(config, key)) {
          const replacement = processValueInner(raw, warnings, stats);
          if (replacement !== raw) {
            edits.push({ start: str.qOpen + 1, end: str.qClose, replacement });
          }
        }
      }
      i = str.nextIndex;
      continue;
    }
    i++;
  }

  let output = input;
  if (edits.length) {
    edits.sort((a, b) => a.start - b.start);
    const parts = [];
    let cursor = 0;
    for (const edit of edits) {
      parts.push(output.slice(cursor, edit.start));
      parts.push(edit.replacement);
      cursor = edit.end;
    }
    parts.push(output.slice(cursor));
    output = parts.join('');
  }

  if (ftlStrings) {
    const ftlEdits = processFtlStrings(output, warnings, stats);
    if (ftlEdits.length) {
      ftlEdits.sort((a, b) => a.start - b.start);
      const parts = [];
      let cursor = 0;
      for (const edit of ftlEdits) {
        parts.push(output.slice(cursor, edit.start));
        parts.push(edit.replacement);
        cursor = edit.end;
      }
      parts.push(output.slice(cursor));
      output = parts.join('');
    }
  }

  return { output, warnings };
}

export default processFtlJson;
