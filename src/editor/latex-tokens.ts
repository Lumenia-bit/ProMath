import { FUNCTION_NAMES } from '../math/ast';
import { MathError } from '../math/errors';
import { LIMITS } from '../math/limits';

export type LatexTokenKind = 'number' | 'constant' | 'variable' | 'function' | 'fraction' | 'root' | 'binomial' | 'operator' | 'open' | 'close' | 'comma' | 'bar' | 'eof';
export interface LatexToken { kind: LatexTokenKind; value: string; start: number; end: number; argumentTail?: boolean }
export const MAX_LATEX_LENGTH = 5000;
const standardFunctions: Record<string, string> = {
  sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', arcsin: 'asin', arccos: 'acos', arctan: 'atan',
  asin: 'asin', acos: 'acos', atan: 'atan', ln: 'ln', log: 'log',
};
const spacing = new Set([',', ';', ':', '!', ' ', 'quad', 'qquad', 'enspace', 'enskip', 'thinspace', 'medspace', 'thickspace', 'negthinspace']);
const styles = new Set(['displaystyle', 'textstyle', 'scriptstyle', 'scriptscriptstyle', 'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'Bigl', 'Bigr', 'biggl', 'biggr', 'Biggl', 'Biggr']);
const commandOperators: Record<string, string> = { times: '*', cdot: '*', div: '/', bmod: '%', mod: '%', '%': 'percentage' };
const commandDelimiters: Record<string, string> = { lparen: '(', rparen: ')', lbrack: '[', rbrack: ']', lbrace: '{', rbrace: '}', '{': '{', '}': '}', vert: '|', lvert: '|', rvert: '|', '|': '|' };

/** A closed vocabulary: LaTeX styling never enables arbitrary text or executable commands. */
export function tokenizeLatex(input: string): LatexToken[] {
  if (input.length > MAX_LATEX_LENGTH) throw new MathError(`Выражение слишком длинное: максимум ${MAX_LATEX_LENGTH} символов в визуальном поле.`);
  const tokens: LatexToken[] = [];
  let cursor = 0;
  let delimiterSide: 'open' | 'close' | undefined;
  const push = (kind: LatexTokenKind, value: string, start: number) => {
    if (tokens.length >= LIMITS.tokens) throw new MathError('Слишком много элементов в выражении.', start);
    tokens.push({ kind, value, start, end: cursor });
  };
  const commandBody = (start: number): string => {
    while (/\s/.test(input[cursor] ?? '') && cursor < input.length) cursor++;
    if (input[cursor++] !== '{') throw new MathError('После математического имени нужны фигурные скобки.', start);
    const end = input.indexOf('}', cursor);
    if (end === -1) throw new MathError('Не закрыта фигурная скобка.', start);
    const body = input.slice(cursor, end);
    cursor = end + 1;
    return body;
  };
  while (cursor < input.length) {
    const start = cursor;
    let character = input[cursor];
    if (/\s/u.test(character)) { cursor++; continue; }
    if (character === '\\') {
      cursor++;
      const letters = input.slice(cursor).match(/^[A-Za-z]+/);
      const command = letters ? letters[0] : input[cursor] ?? '';
      cursor += command.length;
      if (spacing.has(command) || styles.has(command)) continue;
      if (command === 'left' || command === 'right' || command === 'mleft' || command === 'mright') {
        delimiterSide = command === 'left' || command === 'mleft' ? 'open' : 'close';
        while (cursor < input.length && /\s/.test(input[cursor])) cursor++;
        if (input[cursor] === '.') { cursor++; delimiterSide = undefined; }
        continue;
      }
      if (['placeholder', 'placeholderSymbol', 'square'].includes(command)) throw new MathError('Заполните пустую ячейку выражения.', start);
      if (command === 'frac' || command === 'dfrac' || command === 'tfrac') { push('fraction', 'frac', start); continue; }
      if (command === 'sqrt') { push('root', 'sqrt', start); continue; }
      if (command === 'binom' || command === 'dbinom' || command === 'tbinom') { push('binomial', 'ncr', start); continue; }
      if (Object.hasOwn(standardFunctions, command)) { push('function', standardFunctions[command], start); continue; }
      if (command === 'pi') { push('constant', 'pi', start); continue; }
      if (command === 'exponentialE') { push('constant', 'e', start); continue; }
      if (command === 'operatorname' || command === 'mathrm' || command === 'mathnormal' || command === 'mathit' || command === 'text') {
        const body = commandBody(start);
        if ((command === 'mathit' || command === 'mathnormal') && /^[a-z]$/i.test(body)) { push('variable', body.toLowerCase(), start); continue; }
        if (body === 'e') { push('constant', 'e', start); continue; }
        const name = body.toLowerCase();
        if (command === 'operatorname' && FUNCTION_NAMES.has(name)) { push('function', name, start); continue; }
        throw new MathError(`Имя «${body}» не поддерживается. Используйте математическую функцию или константу.`, start);
      }
      const operator = Object.hasOwn(commandOperators, command) ? commandOperators[command] : undefined;
      if (operator) { push('operator', operator, start); continue; }
      const delimiter = Object.hasOwn(commandDelimiters, command) ? commandDelimiters[command] : undefined;
      if (delimiter) {
        character = delimiter;
        if (command === 'lvert') delimiterSide = 'open';
        if (command === 'rvert') delimiterSide = 'close';
      }
      else throw new MathError(`Математический знак \\${command} не поддерживается.`, start, Math.max(1, cursor - start));
    } else if (/[0-9.]/.test(character)) {
      const number = input.slice(cursor).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (!number) throw new MathError('После десятичной точки ожидается цифра.', start);
      cursor += number[0].length;
      push('number', number[0], start);
      continue;
    } else if (/[A-Za-z]/.test(character)) {
      const word = input.slice(cursor).match(/^[A-Za-z]+/)![0];
      cursor += word.length;
      const name = word.toLowerCase();
      if (name === 'pi') push('constant', name, start);
      else if (FUNCTION_NAMES.has(name)) push('function', name, start);
      else if (/^[a-z]+$/u.test(name) && (name.length === 1 || !/^\s*[([{]/u.test(input.slice(cursor)))) {
        for (let offset = 0; offset < name.length; offset++) tokens.push({ kind: 'variable', value: name[offset], start: start + offset, end: start + offset + 1 });
        if (tokens.length > LIMITS.tokens) throw new MathError('Слишком много элементов в выражении.', start);
      } else throw new MathError(`Неизвестное имя «${word}». Переменная — одна буква от a до z; для произведения нескольких букв используйте ×.`, start, word.length);
      continue;
    } else cursor++;
    if ('([{'.includes(character)) push('open', character, start);
    else if (')]}'.includes(character)) push('close', character, start);
    else if (character === '|') push('bar', delimiterSide ?? character, start);
    else if (character === ',') push('comma', character, start);
    else if (character === 'π') push('constant', 'pi', start);
    else {
      const operator = ({ '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', '·': '*', '/': '/', '÷': '/', '^': '^', '!': '!', '%': 'percentage', '_': '_' } as Record<string, string>)[character];
      if (!operator) throw new MathError(`Символ «${character}» не поддерживается.`, start);
      push('operator', operator, start);
    }
    delimiterSide = undefined;
  }
  tokens.push({ kind: 'eof', value: '', start: input.length, end: input.length });
  return tokens;
}
