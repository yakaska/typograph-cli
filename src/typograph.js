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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NBSP = '\u00A0';

// Placeholder (Private Use Area) range used to protect FreeMarker tokens.
export const ATOM_START = 0xe000;
export const ATOM_END = 0xf8ff;
export const ATOM_COUNT = ATOM_END - ATOM_START + 1;
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
export function typograph(text, options = {}) {
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

export default typograph;
