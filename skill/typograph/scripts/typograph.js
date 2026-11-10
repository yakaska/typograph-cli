#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Typograph — core rules engine.
//
// Port of the typography rules from a Sketch plugin. All Sketch/Cocoa
// dependencies removed. Rule behaviour is preserved.
//
// The only intentional (additive) change: Private Use Area characters
// U+E000..U+F8FF are treated as digits in a handful of currency/NBSP rules.
// These characters never occur in normal text; they are emitted by the
// ftl-json mode to protect FreeMarker tokens (e.g. "${amount} руб." ->
// "${amount}\u00A0₽"). This does not alter behaviour for ordinary input.


const NBSP = '\u00A0';

// Placeholder (Private Use Area) range used to protect FreeMarker tokens.
const ATOM_START = 0xe000;
const ATOM_END = 0xf8ff;
const ATOM_COUNT = ATOM_END - ATOM_START + 1;
// String used inside `new RegExp(...)` sources: digit or atom character class.
const DIGIT_OR_ATOM = '[\\d\\uE000-\\uF8FF]';

let _data = null;

function resolveDataDir() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, 'data'),
    path.join(here, '..', 'data'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  throw new Error(
    'typograph: cannot locate "data" directory (looked in ' +
      candidates.join(', ') +
      ')'
  );
}

function loadData() {
  if (_data) return _data;

  const dir = resolveDataDir();
  const read = (name) =>
    fs.readFileSync(path.join(dir, name), 'utf8').replace(/^\uFEFF/, '');

  const noBreakSpace = read('noBreakSpace.txt');
  const beforeNBSP = noBreakSpace.match(/(?:beforeNBSP = )(.*)/m)[1].trim();
  const afterNBSP = noBreakSpace.match(/(?:afterNBSP = )(.*)/m)[1].trim();

  const yoDict = Object.create(null);
  const yoData = read('yo.txt');
  yoData.replace(/(.*ё.*)/gm, (match, p1) => {
    yoDict[p1.replace(/ё/g, 'е')] = p1;
    return match;
  });

  const phoneCodeRu = read('phoneCodeRu.txt').trim();

  const monthWeekday = read('monthWeekday.txt');
  const dataMonth = monthWeekday.match(/(?:month = )(.*)/m)[1].trim();
  const dataMonthShort = monthWeekday.match(/(?:monthShort = )(.*)/m)[1].trim();
  const dataWeekday = monthWeekday.match(/(?:weekday = )(.*)/m)[1].trim();
  const dataWeekdayShort = monthWeekday.match(/(?:weekdayShort = )(.*)/m)[1].trim();

  _data = {
    beforeNBSP,
    afterNBSP,
    yoDict,
    phoneCodeRu,
    dataMonth,
    dataMonthShort,
    dataWeekday,
    dataWeekdayShort,
  };
  return _data;
}

/**
 * Run typography rules over a string.
 *
 * @param {string} text input text
 * @param {{stats?: object}} [options] optional; `options.stats` accumulates
 *   per-category counters (increments, not overwritten).
 * @returns {string} typographed text
 */
function typograph(text, options = {}) {
  const data = loadData();
  const stats = options.stats || {};

  const counters = {
    punctuation: 0,
    replaceQuoteMarks: 0,
    deleteSpaces: 0,
    removeEndDotInSingleString: 0,
    addNoBreakSpace: 0,
    YO: 0,
    dash: 0,
    phoneNumber: 0,
    replaceDotWithComma: 0,
    rub: 0,
    currency: 0,
    lowerCase: 0,
    other: 0,
  };

  let stringToParse = text;

  function punctuation() {
    stringToParse = stringToParse.replace(/(\.{2,}|…)(\!|\?)/gm, (match, p1, p2) => {
      counters.punctuation++;
      return p2 + '\u2025';
    });
    stringToParse = stringToParse.replace(/(\!|\?)(\.{3,}|…)/gm, (match, p1) => {
      counters.punctuation++;
      return p1 + '\u2025';
    });
    stringToParse = stringToParse.replace(/\.{3,}/gm, () => {
      counters.punctuation++;
      return '\u2026';
    });
    stringToParse = stringToParse.replace(/(\?){2,}/gm, (match, p1) => {
      counters.punctuation++;
      return p1;
    });
    stringToParse = stringToParse.replace(/(\!){2,}/gm, (match, p1) => {
      counters.punctuation++;
      return p1;
    });
    stringToParse = stringToParse.replace(/(\.){2,}/gm, (match, p1) => {
      counters.punctuation++;
      return p1;
    });
    stringToParse = stringToParse.replace(/(\,){2,}/gm, (match, p1) => {
      counters.punctuation++;
      return p1;
    });
    stringToParse = stringToParse.replace(/(\;){2,}/gm, (match, p1) => {
      counters.punctuation++;
      return p1;
    });
    stringToParse = stringToParse.replace(/(\:){2,}/gm, (match, p1) => {
      counters.punctuation++;
      return p1;
    });
    stringToParse = stringToParse.replace(/(\-){2,}/gm, (match, p1) => {
      counters.punctuation++;
      return p1;
    });
    stringToParse = stringToParse.replace(/(\!\?)/gm, () => {
      counters.punctuation++;
      return '?!';
    });
    stringToParse = stringToParse.replace(/([^\.])(\.)([\u0022\»\“])(\.)?/gm, (match, p1, p2, p3) => {
      counters.punctuation++;
      return p1 + p3 + p2;
    });
  }

  function replaceQuoteMarks() {
    stringToParse = stringToParse.replace(/(^|\s)[\u0022\u0027]/g, (match, p1) => {
      counters.replaceQuoteMarks++;
      return p1 + '«';
    });
    stringToParse = stringToParse.replace(/(«)[\u0022\u0027]/g, (match, p1) => {
      counters.replaceQuoteMarks++;
      return p1 + '«';
    });
    stringToParse = stringToParse.replace(/([^\s])[\u0022\u0027]([\s\u0022\u0027\»\,\.\…\:\;\!\?\}\u0029\u005D]|$)/gm, (match, p1, p2) => {
      counters.replaceQuoteMarks++;
      return p1 + '»' + p2;
    });
    stringToParse = stringToParse.replace(/(»)[\u0022\u0027]/g, (match, p1) => {
      counters.replaceQuoteMarks++;
      return p1 + '»';
    });

    const newString1 = stringToParse;
    let newString2 = '';
    let previousQuote = '';
    for (let i = 0; i < newString1.length; i++) {
      if (newString1[i] === '«') {
        if (previousQuote === '«' || previousQuote === '“') {
          newString2 += '„';
          previousQuote = '„';
        } else {
          newString2 += newString1[i];
          previousQuote = '«';
        }
      } else if (newString1[i] === '»') {
        if (previousQuote === '„') {
          newString2 += '“';
          previousQuote = '“';
        } else {
          newString2 += newString1[i];
          previousQuote = '»';
        }
      } else {
        newString2 += newString1[i];
      }
      stringToParse = newString2;
    }
  }

  function deleteSpaces() {
    stringToParse = stringToParse.replace(/(\«|\„|\u0022|\u0028|\u005B)\s+/gm, (match, p1) => {
      counters.deleteSpaces++;
      return p1;
    });
    stringToParse = stringToParse.replace(/\s+(\.|\…|\:|\,|\;|\?|\!|\»|\“|\u0022|\u0029|\u005D)/gm, (match, p1) => {
      counters.deleteSpaces++;
      return p1;
    });
    stringToParse = stringToParse.replace(/(\d)\s+(\%)/gm, (match, p1, p2) => {
      counters.deleteSpaces++;
      return p1 + p2;
    });
    if (stringToParse.search(/[^\s]/gm) !== -1) {
      stringToParse = stringToParse.trim();
    }
    stringToParse = stringToParse.replace(/(\u0020|\u00A0){2,}/gm, () => {
      counters.deleteSpaces++;
      return ' ';
    });
  }

  function removeEndDotInSingleString() {
    const searchString = stringToParse.search(/[\.|\!|\?][\s|$]/gm);
    if (searchString <= 1) {
      stringToParse = stringToParse.replace(/\.$/g, () => {
        counters.removeEndDotInSingleString++;
        return '';
      });
    }
  }

  function addNoBreakSpace() {
    let regexp;

    regexp = new RegExp('(^|[\\u0020«„\\"\\(\\[])([А-ЯЁ]\\.)\\u0020?([А-ЯЁ]\\.)?\\u0020?([А-ЯЁ][а-яё]+)([\\s.,;:?!\\"»“‘\\)\\]]|$)', 'gm');
    stringToParse = stringToParse.replace(regexp, (match, p1, p2, p3, p4, p5) => {
      counters.addNoBreakSpace++;
      return p1 + p2 + (p3 ? p3 : '') + NBSP + p4 + p5;
    });

    regexp = new RegExp('(^|[\\u0020«„\\"\\(\\[])([А-ЯЁ][а-яё]+)\\u0020?([А-ЯЁ]\\.)\\u0020?([А-ЯЁ]\\.)?([\\s.,;:?!\\"»“‘\\)\\]]|$)', 'gm');
    stringToParse = stringToParse.replace(regexp, (match, p1, p2, p3, p4, p5) => {
      counters.addNoBreakSpace++;
      return p1 + p2 + NBSP + p3 + (p4 ? p4 : '') + p5;
    });

    stringToParse = stringToParse.replace(/(.)\u0020+(и)\u0020+((т\.д\.)|(т\.п\.)|(др\.))/g, (match, p1, p2, p3) => {
      counters.addNoBreakSpace++;
      return p1 + NBSP + p2 + NBSP + p3;
    });

    const regexpBefore = new RegExp('\\u0020(' + data.beforeNBSP + ')([^А-ЯЁа-яё])', 'gim');
    stringToParse = stringToParse.replace(regexpBefore, (match, p1, p2) => {
      counters.addNoBreakSpace++;
      return NBSP + p1 + p2;
    });

    let regexpAfter = new RegExp('(^|[\\u0020«„\\"\\(\\[])(' + data.afterNBSP + ')\\u0020', 'gim');
    stringToParse = stringToParse.replace(regexpAfter, (match, p1, p2) => {
      counters.addNoBreakSpace++;
      return p1 + p2 + NBSP;
    });

    regexpAfter = new RegExp('(^|[\\u0020«„\\"\\(\\[])(стр|гл|рис|илл?|ст|п|c)\\.\\u0020', 'gim');
    stringToParse = stringToParse.replace(regexpAfter, (match, p1, p2) => {
      counters.addNoBreakSpace++;
      return p1 + p2 + '.' + NBSP;
    });

    stringToParse = stringToParse.replace(/№([^\s])/gm, (match, p1) => {
      counters.addNoBreakSpace++;
      return '№' + NBSP + p1;
    });

    // Additive: atom (PUA) treated as digit.
    stringToParse = stringToParse.replace(new RegExp('(' + DIGIT_OR_ATOM + ')\\u0020+([a-zа-яё])', 'gi'), (match, p1, p2) => {
      counters.addNoBreakSpace++;
      return p1 + NBSP + p2;
    });

    stringToParse = stringToParse.replace(/(^|\,[\u0020\u00A0])(г|обл|кр|ст|пос|с|д|ул|пер|пр|пр-т|просп|пл|бул|б-р|наб|ш|туп|оф|кв|комн?|под|мкр|уч|вл|влад|стр|корп?|эт|пгт)\.\u0020?(\-?[А-ЯЁ\d])/gm, (match, p1, p2, p3) => {
      counters.addNoBreakSpace++;
      return p1 + p2 + '.' + NBSP + p3;
    });

    stringToParse = stringToParse.replace(/(^|\,[\u0020\u00A0])(дом)\u0020(\d)/gm, (match, p1, p2, p3) => {
      counters.addNoBreakSpace++;
      return p1 + p2 + NBSP + p3;
    });

    stringToParse = stringToParse.replace(/(^|\,[\u0020\u00A0])(литера?)\u0020([А-ЯЁ])/gm, (match, p1, p2, p3) => {
      counters.addNoBreakSpace++;
      return p1 + p2 + NBSP + p3;
    });

    regexp = new RegExp('(^|[\\u0020\\u00A0«„\\"\\(\\[])([а-яё]{1,3})\\u0020', 'gmi');
    stringToParse = stringToParse.replace(regexp, (match, p1, p2) => {
      counters.addNoBreakSpace++;
      return p1 + p2 + NBSP;
    });

    stringToParse = stringToParse.replace(/\u0020([а-яё]{1,3}[!?…»]?$)/gmi, (match, p1) => {
      counters.addNoBreakSpace++;
      return NBSP + p1;
    });
    regexp = new RegExp('\\u0020([а-яё]{1,3}[\\.!?…](\\u0020.|$))', 'gmi');
    stringToParse = stringToParse.replace(regexp, (match, p1) => {
      counters.addNoBreakSpace++;
      return NBSP + p1;
    });
    regexp = new RegExp('\\u0020([а-яё]{1,3}[\\.!?…][\\)\\]](\\u0020.|$))', 'gmi');
    stringToParse = stringToParse.replace(regexp, (match, p1) => {
      counters.addNoBreakSpace++;
      return NBSP + p1;
    });
    regexp = new RegExp('\\u0020([а-яё]{1,3}[\\)\\]][\\.!?…](\\u0020.|$))', 'gmi');
    stringToParse = stringToParse.replace(regexp, (match, p1) => {
      counters.addNoBreakSpace++;
      return NBSP + p1;
    });
    regexp = new RegExp('\\u0020([а-яё]{1,3}[!?…][\\"»](\\u0020.|$))', 'gmi');
    stringToParse = stringToParse.replace(regexp, (match, p1) => {
      counters.addNoBreakSpace++;
      return NBSP + p1;
    });
    regexp = new RegExp('\\u0020([а-яё]{1,3}[!?…]?[\\"»][\\.!?…](\\u0020.|$))', 'gmi');
    stringToParse = stringToParse.replace(regexp, (match, p1) => {
      counters.addNoBreakSpace++;
      return NBSP + p1;
    });
  }

  function YO() {
    const re = new RegExp('([а-яё]+)', 'gmi');
    stringToParse = stringToParse.replace(re, (match, p1) => {
      const wordLower = p1.toLowerCase();
      let wordAllCase = '';
      if (wordLower in data.yoDict) {
        const yoDictWord = data.yoDict[wordLower];
        for (let i = 0; i < wordLower.length; i++) {
          if (p1[i] === yoDictWord[i]) {
            wordAllCase = wordAllCase + p1[i];
          } else {
            if (p1[i] === p1[i].toUpperCase()) {
              if (p1[i] === yoDictWord[i].toUpperCase()) {
                wordAllCase = wordAllCase + p1[i];
              } else {
                wordAllCase = wordAllCase + yoDictWord[i].toUpperCase();
              }
            } else {
              wordAllCase = wordAllCase + yoDictWord[i];
            }
          }
        }
        p1 = wordAllCase;
        counters.YO++;
      }
      return p1;
    });
  }

  function phoneNumber() {
    const spaceTmpl = '[\\u0020\\u00A0]?';
    const dashTmpl = '[\\u002D\\u2012\\u2013\\u2014]?';
    const spaceDashTmpl = '[\\u0020\\u00A0\\u002D\\u2012\\u2013\\u2014]?';
    let phoneNumber = '';
    let specialDash = '';

    const reFederal = new RegExp('[\\+\\(]*?' + spaceTmpl + '(8)' + spaceTmpl + '' + dashTmpl + '\\(?(800)' + spaceTmpl + '' + dashTmpl + '[\\)]?' + spaceDashTmpl + '(\\d)' + spaceDashTmpl + '(\\d)' + spaceDashTmpl + '(\\d)' + spaceDashTmpl + '(\\d)' + spaceDashTmpl + '(\\d)' + spaceDashTmpl + '(\\d)' + spaceDashTmpl + '(\\d)', 'gm');
    stringToParse = stringToParse.replace(reFederal, (match, p1, p2, p3, p4, p5, p6, p7, p8, p9) => {
      specialDash = '\u002D';
      phoneNumber = p1 + NBSP + '(' + p2 + ')' + NBSP + p3 + p4 + p5 + specialDash + p6 + p7 + specialDash + p8 + p9;
      if (match !== phoneNumber) {
        counters.phoneNumber++;
      }
      specialDash = '<phoneDash>';
      phoneNumber = p1 + NBSP + '(' + p2 + ')' + NBSP + p3 + p4 + p5 + specialDash + p6 + p7 + specialDash + p8 + p9;
      return phoneNumber;
    });

    const reRu = new RegExp('[\\+\\(]*?' + spaceTmpl + '(7|8)' + spaceTmpl + '' + dashTmpl + '\\(?(' + data.phoneCodeRu + ')' + spaceTmpl + '' + dashTmpl + '[\\)]?' + spaceDashTmpl + '(\\d)' + spaceDashTmpl + '(\\d)' + spaceDashTmpl + '(\\d)' + spaceDashTmpl + '(\\d)' + spaceDashTmpl + '(\\d)' + spaceDashTmpl + '(\\d)?' + spaceDashTmpl + '(\\d)?', 'gm');
    stringToParse = stringToParse.replace(reRu, (match, p1, p2, p3, p4, p5, p6, p7, p8, p9) => {
      p1 = '7';
      specialDash = '\u002D';
      if (p2.length === 3) {
        phoneNumber = '+' + p1 + NBSP + '(' + p2 + ')' + NBSP + p3 + p4 + p5 + specialDash + p6 + p7 + specialDash + p8 + p9;
      } else if (p2.length === 4) {
        phoneNumber = '+' + p1 + NBSP + '(' + p2 + ')' + NBSP + p3 + p4 + specialDash + p5 + p6 + specialDash + p7 + p8;
      }
      if (match !== phoneNumber) {
        counters.phoneNumber++;
      }
      specialDash = '<phoneDash>';
      if (p2.length === 3) {
        phoneNumber = '+' + p1 + NBSP + '(' + p2 + ')' + NBSP + p3 + p4 + p5 + specialDash + p6 + p7 + specialDash + p8 + p9;
      } else if (p2.length === 4) {
        phoneNumber = '+' + p1 + NBSP + '(' + p2 + ')' + NBSP + p3 + p4 + specialDash + p5 + p6 + specialDash + p7 + p8;
      }
      return phoneNumber;
    });

    stringToParse = stringToParse.replace(/(^|\D)(\+900|\#900|\@900)(\D|$)/gm, (match, p1, p2, p3) => {
      counters.phoneNumber++;
      return p1 + '900' + p3;
    });
  }

  function dash() {
    const dashAll = '[\\u002D\\u2012\\u2013\\u2014]';

    let re = new RegExp('(^|[\\.|\\!|\\?][\\u0020\\u00A0])(' + dashAll + ')(.)?', 'gm');
    stringToParse = stringToParse.replace(re, (match, p1, p2, p3) => {
      if (p2 !== '\u2014') {
        p2 = '\u2014';
        counters.dash++;
      }
      if (p3 === '\u0020') {
        p3 = NBSP;
        counters.addNoBreakSpace++;
      }
      if (p3 !== NBSP) {
        p3 = NBSP + p3;
        counters.addNoBreakSpace++;
      }
      return p1 + p2 + p3;
    });

    function monthWeekday(params) {
      const re = new RegExp('((' + params + ')\\.?)([\\u0020\\u00A0])?(' + dashAll + ')([\\u0020\\u00A0])?((' + params + ')\\.?)', 'gmi');
      stringToParse = stringToParse.replace(re, (match, p1, p2, p3, p4, p5, p6, p7) => {
        if (p4 !== '\u2013') {
          p4 = '\u2013';
          counters.dash++;
        }
        if (p3 !== undefined) {
          counters.deleteSpaces++;
        }
        if (p5 !== undefined) {
          counters.deleteSpaces++;
        }
        return p1 + p4 + p6;
      });
    }
    monthWeekday(data.dataMonth);
    monthWeekday(data.dataMonthShort);
    monthWeekday(data.dataWeekday);
    monthWeekday(data.dataWeekdayShort);

    re = new RegExp('([^\\.\\!\\?\\dXIV])([\\u0020\\u00A0])(' + dashAll + ')([\\u0020\\u00A0])?([^\\dXIV])', 'gm');
    stringToParse = stringToParse.replace(re, (match, p1, p2, p3, p4, p5) => {
      if (p2 === '\u0020') {
        p2 = NBSP;
        counters.addNoBreakSpace++;
      }
      if (p3 !== '\u2014') {
        p3 = '\u2014';
        counters.dash++;
      }
      if (p4 !== '\u20A0') {
        p4 = '\u0020';
      }
      return p1 + p2 + p3 + p4 + p5;
    });

    re = new RegExp('(\\d|[XIV])([\\u0020\\u00A0])?(' + dashAll + ')([\\u0020\\u00A0])?(\\d|[XIV])', 'gm');
    stringToParse = stringToParse.replace(re, (match, p1, p2, p3, p4, p5) => {
      if (p3 !== '\u2013') {
        p3 = '\u2013';
        counters.dash++;
      }
      p2 = p4 = '';
      return p1 + p2 + p3 + p4 + p5;
    });

    stringToParse = stringToParse.replace(/<phoneDash>/gm, () => '\u002D');
  }

  function lowerCase() {
    function toLowerCase(params) {
      let regexp = new RegExp('(^|[\\.\\!\\?\\…][\\u0020\\u00A0])(\\u2014[\\u0020\\u00A0])?(' + params + ')(?=[\\u0020\\u00A0\\…\\,\\;\\:\\?\\!\\"»“‘\\)\\]])', 'gm');
      stringToParse = stringToParse.replace(regexp, (match, p1, p2, p3) => {
        if (p2 === undefined) {
          p2 = '';
        }
        return p1 + p2 + '<noReplace>' + p3 + '<noReplace>';
      });
      regexp = new RegExp('(^|[\\u0020\\u00A0«„\\"\\(\\[])(' + params + ')(?=[\\u0020\\u00A0\\…\\,\\;\\:\\?\\!\\"»“‘\\)\\]])', 'gm');
      stringToParse = stringToParse.replace(regexp, (match, p1, p2) => {
        counters.lowerCase++;
        return p1 + p2.toLowerCase();
      });
      stringToParse = stringToParse.replace(/<noReplace>/g, '');
    }
    toLowerCase('Вы|Вас|Вам|Вами|Ваш|Ваше|Вашего|Ваша|Вашей|Ваши|Ваших');
    toLowerCase('Банк|Банки|Банка|Банков|Банку|Банкам|Банком|Банками|Банке|Банках');
    toLowerCase('Приложение|Приложения|Приложений|Приложению|Приложениям|Приложением|Приложениями|Приложении|Приложениях|Приложении');
    toLowerCase('Условие|Условия|Условий|Условию|Условиям|Условием|Условиями|Условии|Условиях');
    toLowerCase('Сайт|Сайта|Сайту|Сайтом|Сайте|Сайты|Сайтов|Сайтам|Сайты|Сайтами|Сайтах');
  }

  function numbers() {
    stringToParse = stringToParse.replace(/(\d+)(([.,])(\d+))?(\u00A0(тыс|млн|млрд|трлн|₽|\$|€|£|¥))?/g, (match, p1, p2, p3, p4, p5) => {
      let integerPart = p1;
      if (p1.length >= 5 || p5 !== undefined) {
        integerPart = p1.replace(/(\d)(?=(\d{3})+([\D]|$))/g, (m, a1) => {
          counters.addNoBreakSpace++;
          return a1 + NBSP;
        });
      }

      let fractionalPart;
      if (p2 === undefined) {
        fractionalPart = '';
      } else {
        fractionalPart = ',' + p4;
        counters.replaceDotWithComma++;
      }

      let currencyPart = '';
      if (p5 !== undefined) {
        currencyPart = p5;
      }

      return integerPart + fractionalPart + currencyPart;
    });

    stringToParse = stringToParse.replace(/(^|\D)(\d{2})\,(\d{2})(?!\u00A0(тыс|млн|млрд|трлн|₽|\$|€|£|¥))(\,(\d{4}))?($|\D)/gm, (match, p1, p2, p3, p4, p5, p6, p7) => {
      counters.replaceDotWithComma--;
      let year = '';
      if (p5 !== undefined) {
        year = '.' + p6;
      }
      return p1 + p2 + '.' + p3 + year + p7;
    });

    stringToParse = stringToParse.replace(/(^|\D)(\d{3})\u00A0(\d{3})(\,\u0020)/gm, (match, p1, p2, p3, p4) => {
      counters.addNoBreakSpace--;
      return p1 + p2 + p3 + p4;
    });

    stringToParse = stringToParse.replace(/(\d\u00A0\()(\d)\u00A0(\d{3})(\)\u00A0\d)/gm, (match, p1, p2, p3, p4) => {
      counters.addNoBreakSpace--;
      return p1 + p2 + p3 + p4;
    });

    stringToParse = stringToParse.replace(/(^|\D)(\d{2})\u00A0(\d{3})\u00A0(\d{3})\u00A0(\d{3})\u00A0(\d{3})\u00A0(\d{3})\u00A0(\d{3})($|\D)/gm, (match, p1, p2, p3, p4, p5, p6, p7, p8) => {
      counters.addNoBreakSpace = counters.addNoBreakSpace - 6;
      return p1 + p2 + p3 + p4 + p5 + p6 + p7 + p8;
    });
  }

  function currency() {
    // После тыс должна быть точка
    stringToParse = stringToParse.replace(/(тыс)([!?,:;\u00A0\u0020\n]|$)/gmi, (match, p1, p2) => {
      return p1 + '.' + p2;
    });
    // После млн млрд трлн точки быть не должно
    stringToParse = stringToParse.replace(/(млн|млрд|трлн)\./gmi, (match, p1) => {
      return p1;
    });
    // Ставим точку после млн млрд трлн, если это конец предложения
    stringToParse = stringToParse.replace(/(млн|млрд|трлн)(\u0020|\u00A0)((«|—(\u0020|\u00A0))?[А-ЯЁ])/gm, (match, p1, p2, p3) => {
      return p1 + '.' + p2 + p3;
    });

    // Additive: atom (PUA) treated as digit (numPrefix includes atom class).
    const numPrefix = '(' + DIGIT_OR_ATOM + '|тыс\\.|млн|млрд|трлн)';

    // Переводим USD в $
    stringToParse = stringToParse.replace(new RegExp(numPrefix + '(\\u0020|\\u00A0)?(USD)\\.?([!?,:;\\u00A0\\u0020\\n]|$)', 'gmi'), (match, p1, p2, p3, p4) => {
      counters.currency++;
      counters.addNoBreakSpace++;
      return p1 + NBSP + '$' + p4;
    });
    // Переводим EUR в €
    stringToParse = stringToParse.replace(new RegExp(numPrefix + '(\\u0020|\\u00A0)?(EUR)\\.?([!?,:;\\u00A0\\u0020\\n]|$)', 'gmi'), (match, p1, p2, p3, p4) => {
      counters.currency++;
      counters.addNoBreakSpace++;
      return p1 + NBSP + '€' + p4;
    });
    // Переводим Р, р., руб. RUR RUB в ₽
    stringToParse = stringToParse.replace(new RegExp(numPrefix + '(\\u0020|\\u00A0)?(р|руб|RUR|RUB)\\.?([!?,:;\\u00A0\\u0020\\n]|$)', 'gmi'), (match, p1, p2, p3, p4) => {
      counters.rub++;
      counters.addNoBreakSpace++;
      return p1 + NBSP + '₽' + p4;
    });
    // Убираем копейки в основную сумму
    stringToParse = stringToParse.replace(/(\d)(\u00A0₽)(\u0020|\u00A0)(\d{1,2})(\u0020|\u00A0)?(к|коп)\.?([!?,:;\u00A0\u0020\n]|$)/gmi, (match, p1, p2, p3, p4, p5, p6, p7) => {
      let kop;
      if (p4.length === 1) {
        kop = '0' + p4;
      } else {
        kop = p4;
      }
      return p1 + ',' + kop + p2 + p7;
    });
    // Ставим точку после ₽, если это конец предложения
    stringToParse = stringToParse.replace(/(\d\u00A0₽)(\u0020|\u00A0)((«|—(\u0020|\u00A0))?[А-ЯЁ])/gm, (match, p1, p2, p3) => {
      return p1 + '.' + p2 + p3;
    });
    // Переносим знак валюты после цифр и отделяем неразрывным пробелом
    stringToParse = stringToParse.replace(/(^|[\D]{2})(₽|\$|€|£|¥)[\u0020\u00A0]?(\d+([\u0020\u00A0]\d{3})*([.,]\d+)?)([\u0020\u00A0]?(тыс\.|млн|млрд|трлн))?/gm, (match, p1, p2, p3, p4, p5, p6, p7) => {
      let sokr;
      if (p7 === undefined) {
        sokr = '';
      } else {
        sokr = NBSP + p7;
      }
      counters.currency++;
      counters.addNoBreakSpace++;
      return p1 + p3 + sokr + NBSP + p2;
    });
    // Отделяем знак валюты от числа (additive: atom treated as digit)
    stringToParse = stringToParse.replace(new RegExp('(' + DIGIT_OR_ATOM + ')(₽|\\$|€|£|¥)', 'gm'), (match, p1, p2) => {
      counters.currency++;
      counters.addNoBreakSpace++;
      return p1 + NBSP + p2;
    });
  }

  function misc() {
    stringToParse = stringToParse.replace(/(Master[\u0020\u00A0]Card|MasterCard)/gmi, (match) => {
      if (match !== 'Mastercard') {
        counters.other++;
      }
      return 'Mastercard';
    });
    stringToParse = stringToParse.replace(/(VISA)/gm, () => {
      counters.other++;
      return 'Visa';
    });
    stringToParse = stringToParse.replace(/(МИР)/gm, () => {
      counters.other++;
      return 'Мир';
    });
    stringToParse = stringToParse.replace(/(Google[\u0020\u00A0]pay|Гугл[\u0020\u00A0]Пэй)/gmi, (match) => {
      if (match !== 'Google\u00A0Pay') {
        counters.other++;
      }
      return 'Google\u00A0Pay';
    });
    stringToParse = stringToParse.replace(/(Apple[\u0020\u00A0]pay|Эпл[\u0020\u00A0]Пэй)/gmi, (match) => {
      if (match !== 'Apple\u00A0Pay') {
        counters.other++;
      }
      return 'Apple\u00A0Pay';
    });
    stringToParse = stringToParse.replace(/(push|пуш)([\u0020\u00A0\u002D\u2012\u2013\u2014])(уведомлен)([ие|ия|ий|ию|иям|ием|иями|ии|иях])/gmi, (match, p1, p2, p3, p4) => {
      if (p1 + p2 + p3 !== 'Push-уведомлен') {
        counters.other++;
      }
      return 'Push-' + p3.toLowerCase() + p4.toLowerCase();
    });
    stringToParse = stringToParse.replace(/(pin|пин)([\u0020\u00A0\u002D\u2012\u2013\u2014])(код)([ы|а|ов|у|ам|ы|ом|ами|е|ах])?/gmi, (match, p1, p2, p3, p4) => {
      if (p1 + p2 + p3 !== 'ПИН-код') {
        counters.other++;
      }
      if (p4 === undefined) {
        p4 = '';
      }
      return 'ПИН-' + p3.toLowerCase() + p4.toLowerCase();
    });
    stringToParse = stringToParse.replace(/(QR)([\u0020\u00A0\u002D\u2012\u2013\u2014])(code|код)([ы|а|ов|у|ам|ы|ом|ами|е|ах])?/gmi, (match, p1, p2, p3, p4) => {
      if (p1 + p2 + p3 !== 'QR-код') {
        counters.other++;
      }
      if (p4 === undefined) {
        p4 = '';
      }
      return 'QR-' + p3.toLowerCase() + p4.toLowerCase();
    });
    stringToParse = stringToParse.replace(/((^|\n|[\.\!\?\…][\u0020\u00A0])(\u2014[\u0020\u00A0])?)?(sim|сим)([\u0020\u00A0\u002D\u2012\u2013\u2014])(карт)([а|ы|е|ам|у|ы|ой|ами|ах])?/gmi, (match, p1, p2, p3, p4, p5, p6, p7) => {
      let sim;
      if (p1 !== undefined) {
        sim = 'Сим-карт';
      } else {
        sim = 'сим-карт';
        p1 = '';
      }
      if (p4 + p5 + p6 !== sim) {
        counters.other++;
      }
      if (p7 === undefined) {
        p7 = '';
      }
      return p1 + sim + p7.toLowerCase();
    });
    stringToParse = stringToParse.replace(/(cvv|cvc|cvv2|cvc2)([\u0020\u00A0\u002D\u2012\u2013\u2014])?(код)?([ы|а|ов|у|ам|ы|ом|ами|е|ах])?/gmi, (match, p1, p2, p3, p4) => {
      if (p2 === undefined && p3 === undefined) {
        if (p1 !== 'CVV' && p1 !== 'CVC' && p1 !== 'CVV2' && p1 !== 'CVC2') {
          counters.other++;
        }
      } else {
        if ((p1 !== 'CVV' && p1 !== 'CVC' && p1 !== 'CVC2') || (p2 + p3 !== '-код')) {
          counters.other++;
        }
      }
      if (p2 === undefined) {
        p2 = '';
      } else {
        p2 = '-';
      }
      if (p3 === undefined) {
        p3 = '';
      }
      if (p4 === undefined) {
        p4 = '';
      }
      return p1.toUpperCase() + p2 + p3.toLowerCase() + p4.toLowerCase();
    });
    stringToParse = stringToParse.replace(/(sms|смс)/gmi, (match) => {
      if (match !== 'СМС') {
        counters.other++;
      }
      return 'СМС';
    });
    stringToParse = stringToParse.replace(/(wifi|wi-fi)/gmi, (match) => {
      if (match !== 'Wi-Fi') {
        counters.other++;
      }
      return 'Wi-Fi';
    });
    stringToParse = stringToParse.replace(/((^|\n|[\.\!\?\…][\u0020\u00A0])(\u2014[\u0020\u00A0])?)?(e-mail|email|имейл|емейл)/gmi, (match, p1, p2, p3, p4) => {
      let email;
      if (p1 !== undefined) {
        email = 'Email';
      } else {
        email = 'email';
        p1 = '';
      }
      if (p4 !== email) {
        counters.other++;
      }
      return p1 + email;
    });
    stringToParse = stringToParse.replace(/(((^|\n|[\.\!\?\…][\u0020\u00A0])(\u2014[\u0020\u00A0])?)|((^|\n|[\.\!\?\…][\u0020\u00A0]?)\u00AB))?(оффлайн|офлайн|офф-лайн|оф-лайн)/gmi, (match, p1, p2, p3, p4) => {
      let offline;
      if (p1 !== undefined) {
        offline = 'Офлайн';
      } else {
        offline = 'офлайн';
        p1 = '';
      }
      if (p4 !== offline) {
        counters.other++;
      }
      return p1 + offline;
    });
    stringToParse = stringToParse.replace(/(((^|\n|[\.\!\?\…][\u0020\u00A0])(\u2014[\u0020\u00A0])?)|((^|\n|[\.\!\?\…][\u0020\u00A0]?)\u00AB))?(оннлайн|онлайн|онн-лайн|он-лайн)/gmi, (match, p1, p2, p3, p4) => {
      let online;
      if (p1 !== undefined) {
        online = 'Онлайн';
      } else {
        online = 'онлайн';
        p1 = '';
      }
      if (p4 !== online) {
        counters.other++;
      }
      return p1 + online;
    });
    stringToParse = stringToParse.replace(/(мск|msk)/gmi, (match) => {
      if (match !== 'мск') {
        counters.other++;
      }
      return 'мск';
    });

    // Разделитель «··» (две точки U+00B7): оборачиваем неразрывными пробелами
    stringToParse = stringToParse.replace(/(\u0020|\u00A0)?(\u00B7\u00B7)(\u0020|\u00A0)?/g, (match, before, sep, after) => {
      const out = (before === undefined ? '' : '\u00A0') + sep + (after === undefined ? '' : '\u00A0');
      if (out !== match) {
        counters.other++;
      }
      return out;
    });
  }

  punctuation();
  replaceQuoteMarks();
  deleteSpaces();
  removeEndDotInSingleString();
  addNoBreakSpace();
  YO();
  phoneNumber();
  dash();
  currency();
  numbers();
  lowerCase();
  misc();

  for (const key in counters) {
    stats[key] = (stats[key] || 0) + counters[key];
  }

  return stringToParse;
}



// Configuration for the ftl-json mode: which JSON fields are processed.


const DEFAULT_FIELDS = [
  'title',
  'subtitle',
  'text',
  'description',
  'label',
  'message',
  'buttonText',
];

const DEFAULT_EXCLUDE_FIELDS = [
  'type',
  'icon',
  'uri',
  'url',
  'link',
  'id',
  'toggle',
  'eventForAnalytic',
  'paramsForAnalytic',
  'subtitleVoice',
  'titleVoice',
];

const DEFAULT_EXCLUDE_SUFFIXES = ['Voice'];

const RC_NAME = '.typographrc.json';

function findRcFile(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, RC_NAME);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Resolve the effective field configuration.
 *
 * @param {{fields?: string, excludeFields?: string, cwd?: string}} options
 *   `fields` / `excludeFields` are comma-separated strings from the CLI.
 */
function resolveConfig(options = {}) {
  const cwd = options.cwd || process.cwd();
  let fields = DEFAULT_FIELDS.slice();
  let excludeFields = DEFAULT_EXCLUDE_FIELDS.slice();
  let excludeSuffixes = DEFAULT_EXCLUDE_SUFFIXES.slice();

  const rcPath = findRcFile(cwd);
  if (rcPath) {
    let rc = null;
    try {
      rc = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
    } catch {
      rc = null;
    }
    if (rc) {
      if (Array.isArray(rc.fields)) fields = rc.fields.map(String);
      if (Array.isArray(rc.excludeFields)) excludeFields = rc.excludeFields.map(String);
      if (Array.isArray(rc.excludeSuffixes)) excludeSuffixes = rc.excludeSuffixes.map(String);
    }
  }

  if (options.fields) {
    fields = options.fields.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (options.excludeFields) {
    excludeFields = options.excludeFields.split(',').map((s) => s.trim()).filter(Boolean);
  }

  return {
    fields: new Set(fields),
    excludeFields: new Set(excludeFields),
    excludeSuffixes,
    rcPath,
  };
}

function shouldProcess(config, key) {
  if (!key) return false;
  if (config.excludeFields.has(key)) return false;
  for (const suffix of config.excludeSuffixes) {
    if (key.endsWith(suffix)) return false;
  }
  return config.fields.has(key);
}


// ftl-json mode: process textual JSON string values inside a FreeMarker
// template that renders to JSON.
//
// The template is *not* valid JSON before rendering (FreeMarker directives
// interleave with JSON structure), so JSON.parse is never used. Instead we
// lex FreeMarker tokens, then scan JSON string literals in the remaining text.


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
function lexFreeMarker(input) {
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

function unescapeJson(s) {
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
function processFtlJson(input, options = {}) {
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



// CLI for typograph.


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

function parseArgs(argv) {
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

function main(argv) {
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


process.exitCode = main(process.argv.slice(2));
