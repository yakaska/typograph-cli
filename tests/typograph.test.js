import { test } from 'node:test';
import assert from 'node:assert/strict';
import { typograph, ATOM_START } from '../src/typograph.js';

const NBSP = '\u00A0';

test('ёфикатор', () => {
  assert.equal(typograph('зеленый'), 'зелёный');
  assert.equal(typograph('ежик'), 'ёжик');
});

test('кавычки', () => {
  assert.equal(typograph('"тест"'), '«тест»');
  assert.equal(typograph('сказал "привет" и ушел'), `сказал «привет» и${NBSP}ушёл`);
});

test('телефонные номера', () => {
  assert.equal(typograph('8 800 555 55 50'), `8${NBSP}(800)${NBSP}555-55-50`);
  assert.equal(typograph('8 (800) 555-55-50'), `8${NBSP}(800)${NBSP}555-55-50`);
  assert.equal(typograph('+7 495 500-55-50'), `+7${NBSP}(495)${NBSP}500-55-50`);
  assert.equal(typograph('+7 (4212) 79-40-35'), `+7${NBSP}(4212)${NBSP}79-40-35`);
});

test('тире', () => {
  assert.equal(typograph('январь-март'), 'январь–март');
  assert.equal(typograph('понедельник-суббота'), 'понедельник–суббота');
  assert.equal(typograph('2002-2009'), '2002–2009');
  assert.equal(typograph('XI-XII'), 'XI–XII');
  assert.equal(
    typograph('А гений и злодейство - две вещи несовместные'),
    `А${NBSP}гений и${NBSP}злодейство${NBSP}— две${NBSP}вещи несовместные`
  );
});

test('пунктуация', () => {
  assert.equal(typograph('Готово!!!'), 'Готово!');
  assert.equal(typograph('что?!'), 'что?!');
  assert.equal(typograph('что!?'), 'что?!');
  assert.equal(typograph('многоточие...'), 'многоточие…');
});

test('числа и валюта', () => {
  assert.equal(typograph('2345123 $'), `2${NBSP}345${NBSP}123 $`);
  assert.equal(typograph('143.56 $'), '143,56 $');
  assert.equal(typograph('20usd'), `20${NBSP}$`);
  assert.equal(typograph('789 руб.'), `789${NBSP}₽`);
  assert.equal(typograph('45 руб. 5 коп.'), `45,05${NBSP}₽`);
  assert.equal(typograph('$ 109'), `109${NBSP}$`);
  assert.equal(typograph('109$'), `109${NBSP}$`);
});

test('неразрывные пробелы', () => {
  assert.equal(typograph('А.А. Иванов'), `А.А.${NBSP}Иванов`);
  assert.equal(typograph('Петров К.П. написал'), `Петров${NBSP}К.П. написал`);
  assert.equal(typograph('№123'), `№${NBSP}123`);
  assert.equal(typograph('если бы точно'), `если${NBSP}бы${NBSP}точно`);
});

test('строчные буквы', () => {
  assert.equal(typograph('Если Вы хотите оплатить'), `Если${NBSP}вы${NBSP}хотите оплатить`);
});

test('разное', () => {
  assert.equal(typograph('VISA'), 'Visa');
  assert.equal(typograph('МИР'), 'Мир');
  assert.equal(typograph('MasterCard'), 'Mastercard');
  assert.equal(typograph('wifi'), 'Wi-Fi');
  assert.equal(typograph('sms'), 'СМС');
  assert.equal(typograph('пин код'), 'ПИН-код');
  assert.equal(typograph('QR код'), 'QR-код');
  assert.equal(typograph('e-mail'), 'email');
  assert.equal(typograph('оннлайн'), 'онлайн');
  assert.equal(typograph('msk'), 'мск');
});

test('разделитель ··', () => {
  assert.equal(typograph('A ·· B'), `A${NBSP}··${NBSP}B`);
  assert.equal(typograph('Сумма ·· итог'), `Сумма${NBSP}··${NBSP}итог`);
});

test('плейсхолдер (PUA) ведёт себя как число', () => {
  const atom = String.fromCodePoint(ATOM_START);
  assert.equal(typograph(`${atom} руб.`), `${atom}${NBSP}₽`);
  assert.equal(typograph(`${atom} дней`), `${atom}${NBSP}дней`);
});

test('идемпотентность', () => {
  const inputs = [
    'зеленый ежик',
    '"Какая-то "цитата" тут"',
    'А гений и злодейство - две вещи несовместные',
    '2345123 $ и 143.56 $',
    '45 руб. 5 коп. и 20usd',
    '8 800 555 55 50 или +7 495 500-55-50',
    'А.А. Иванов, Петров К.П., №123',
    'Готово!!! и многоточие...',
    'Если Вы хотите, банк поможет',
    'VISA',
    'MasterCard',
    'МИР',
    'wifi',
    'sms',
    'пин код',
    'QR код',
    'e-mail',
    'оннлайн',
    'msk',
    'январь-март, 2002-2009, XI-XII',
    'A ·· B, Сумма ·· итог',
  ];
  for (const input of inputs) {
    const once = typograph(input);
    const twice = typograph(once);
    assert.equal(twice, once, `not idempotent for: ${JSON.stringify(input)}`);
  }
});
