import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processFtlJson } from '../src/ftl-json.js';
import { resolveConfig } from '../src/config.js';
import { main } from '../src/cli.js';

const NBSP = '\u00A0';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');

function proc(input, opts = {}) {
  return processFtlJson(input, { config: resolveConfig(), ...opts });
}

test('обычный JSON-объект', () => {
  const { output } = proc('{"title": "Зеленый ежик", "url": "https://example.com/a/b"}');
  assert.equal(output, '{"title": "Зелёный ёжик", "url": "https://example.com/a/b"}');
});

test('массив объектов', () => {
  const { output } = proc('[{"title": "Сумма к оплате"}, {"title": "Дата"}]');
  assert.equal(output, `[{"title": "Сумма к${NBSP}оплате"}, {"title": "Дата"}]`);
});

test('значение с интерполяцией: ${amount} руб. -> ${amount} NBSP ₽', () => {
  const { output } = proc('{"title": "Сумма ${amount} руб."}');
  assert.equal(output, `{"title": "Сумма \${amount}${NBSP}₽"}`);
});

test('экранирование: \\", \\n, \\u0435', () => {
  const { output } = proc('{"title": "Сумма \\"важно\\" тут\\nи \\u0435"}');
  assert.equal(output, '{"title": "Сумма «важно»\u00A0тут\\nи\u00A0е"}');
});

test('ключ url не меняется', () => {
  const input = '{"title": "Тест", "url": "https://example.com/credits/agreement"}';
  assert.equal(proc(input).output, input);
});

test('поле вне белого списка не меняется', () => {
  const input = '{"title": "Тест", "note": "Сумма к оплате", "uri": "tel:8800"}';
  assert.equal(proc(input).output, input);
});

test('значение целиком из FreeMarker-токенов не меняется', () => {
  const input = '{"title": "${productName} ${fullRepaymentAmount}", "subtitle": "${documentTitle}"}';
  assert.equal(proc(input).output, input);
});

test('главный fixture: полное совпадение', () => {
  const input = fs.readFileSync(path.join(FIXTURES, 'main.ftl'), 'utf8');
  const expected = fs.readFileSync(path.join(FIXTURES, 'main.out.ftl'), 'utf8');
  const { output, warnings } = proc(input);
  assert.deepEqual(warnings, []);
  assert.equal(output, expected);
});

test('главный fixture: идемпотентность', () => {
  const input = fs.readFileSync(path.join(FIXTURES, 'main.ftl'), 'utf8');
  const once = proc(input).output;
  const twice = proc(once).output;
  assert.equal(twice, once);
});

test('неоднозначная строка -> предупреждение, без падения', () => {
  const { output, warnings } = proc('{"title": "незакрытая строка');
  assert.equal(output, '{"title": "незакрытая строка');
  assert.ok(warnings.some((w) => /unterminated JSON string/.test(w)));
});

test('--ftl-strings: русский литерал в <#assign>', () => {
  const { output } = proc('<#assign x = "Зеленый ежик">\n{"title": "Тест"}', { ftlStrings: true });
  assert.equal(output, '<#assign x = "Зелёный ёжик">\n{"title": "Тест"}');
});

test('--ftl-strings: конкатенация пропускается с предупреждением', () => {
  const { output, warnings } = proc('<#assign x = "Зеленый ежик" + suffix>', { ftlStrings: true });
  assert.equal(output, '<#assign x = "Зеленый ежик" + suffix>');
  assert.ok(warnings.some((w) => /concatenation skipped/.test(w)));
});

test('CLI --check возвращает код 1 при изменениях', () => {
  const file = path.join(FIXTURES, 'main.ftl');
  const code = main(['--mode', 'ftl-json', '--check', file]);
  assert.equal(code, 1);
});

test('CLI --check возвращает код 0 без изменений', () => {
  const file = path.join(FIXTURES, 'main.out.ftl');
  const code = main(['--mode', 'ftl-json', '--check', file]);
  assert.equal(code, 0);
});

// ---------------------------------------------------------------------------
// Новый шаблон (test.ftl): макросы, вложенные кавычки, deeplink, ··
// ---------------------------------------------------------------------------

test('макрос <#macro>: строки внутри тела макроса обрабатываются', () => {
  const input = '<#macro banner>\n  {\n    "title": "Сумма к оплате",\n    "subtitle": "с карты банка"\n  }\n</#macro>\n{ "widgets": [ <@banner/> ] }';
  const expected = `<#macro banner>\n  {\n    "title": "Сумма к${NBSP}оплате",\n    "subtitle": "с${NBSP}карты банка"\n  }\n</#macro>\n{ "widgets": [ <@banner/> ] }`;
  const { output, warnings } = proc(input);
  assert.deepEqual(warnings, []);
  assert.equal(output, expected);
});

test('интерполяция с одинарными кавычками ${x?string(\'d MMMM\')} непрозрачна', () => {
  const { output } = proc('{"title": "Заблокирована до ${date?string(\'d MMMM\')}"}');
  assert.equal(output, `{"title": "Заблокирована до${NBSP}\${date?string('d MMMM')}"}`);
});

test('поле deeplink не в белом списке -> не меняется', () => {
  const input = '{"title": "Сумма к оплате", "deeplink": "payments/p2p?type=x&amount=${a}"}';
  assert.equal(proc(input).output, `{"title": "Сумма к${NBSP}оплате", "deeplink": "payments/p2p?type=x&amount=\${a}"}`);
});

test('разделитель ·· внутри значения с интерполяциями', () => {
  const { output } = proc('{"subtitle": "${a} ·· ${b}"}');
  assert.equal(output, `{"subtitle": "\${a}${NBSP}··${NBSP}\${b}"}`);
});

test('вложенные кавычки внутри ${...} не ломают разбор строки', () => {
  const input = '{"title": "Текст ${x?switch("A", "B")} к оплате"}';
  const { output, warnings } = proc(input);
  assert.deepEqual(warnings, []);
  assert.equal(output, `{"title": "Текст \${x?switch("A", "B")}${NBSP}к${NBSP}оплате"}`);
});

test('экранированные кавычки и backslash внутри ${...} (как в test.ftl)', () => {
  const input = '{"subtitle": "${debtInfo.loanType?replace("\\"", "\\\\\\"")} ·· ${formatPayment(debtInfo.loanAmount)}"}';
  const { output, warnings } = proc(input);
  assert.deepEqual(warnings, []);
  assert.equal(
    output,
    `{"subtitle": "\${debtInfo.loanType?replace("\\"", "\\\\\\"")}${NBSP}··${NBSP}\${formatPayment(debtInfo.loanAmount)}"}`
  );
});

test('новый шаблон (complex.ftl): уже вытипографирован -> без изменений и предупреждений', () => {
  const input = fs.readFileSync(path.join(FIXTURES, 'complex.ftl'), 'utf8');
  const { output, warnings } = proc(input);
  assert.deepEqual(warnings, []);
  assert.equal(output, input);
});

test('новый шаблон (complex.ftl): идемпотентность', () => {
  const input = fs.readFileSync(path.join(FIXTURES, 'complex.ftl'), 'utf8');
  const once = proc(input).output;
  const twice = proc(once).output;
  assert.equal(twice, once);
});

