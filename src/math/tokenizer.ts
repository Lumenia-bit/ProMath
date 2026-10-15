import { FUNCTION_NAMES } from './ast';
import { MathError } from './errors';
import { LIMITS } from './limits';

export type TokenType = 'number' | 'constant' | 'variable' | 'identifier' | 'operator' | 'lparen' | 'rparen' | 'comma' | 'eof';
export interface Token { type: TokenType; value: string; start: number; end: number }

const operators: Record<string, string> = { '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', '·': '*', '/': '/', '÷': '/', '%': '%', '^': '^', '!': '!' };

/** Lexes only the explicitly supported mathematical vocabulary. */
export function tokenize(input: string): Token[] {
  if (input.length > LIMITS.inputLength) throw new MathError(`Выражение слишком длинное: максимум ${LIMITS.inputLength} символов.`, LIMITS.inputLength);
  const tokens: Token[] = [];
  let position = 0;
  const push = (type: TokenType, value: string, start: number, end: number) => {
    if (tokens.length >= LIMITS.tokens) throw new MathError('Слишком много элементов в выражении.', start, end - start);
    tokens.push({ type, value, start, end });
  };
  while (position < input.length) {
    const character = input[position];
    if (/\s/u.test(character)) { position++; continue; }
    const start = position;
    if (/[0-9.]/u.test(character)) {
      const match = input.slice(position).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/u);
      if (!match) throw new MathError('После десятичной точки ожидается цифра.', position);
      position += match[0].length;
      if (input[position] === '.') throw new MathError('В числе может быть только одна десятичная точка.', position);
      if (/[eE]/u.test(input[position] ?? '') && /[0-9+-]/u.test(input[position + 1] ?? '')) {
        throw new MathError('Некорректная научная запись: после e нужен один целый показатель степени.', position);
      }
      push('number', match[0], start, position);
      continue;
    }
    if (character === 'π') { push('constant', 'pi', position, ++position); continue; }
    if (/[a-zA-Zа-яА-ЯёЁ]/u.test(character)) {
      const match = input.slice(position).match(/^[a-zA-Zа-яА-ЯёЁ]+/u)!;
      const word = match[0].toLowerCase();
      position += match[0].length;
      if (word === 'pi' || word === 'e') push('constant', word, start, position);
      else if (word === 'of' || word === 'от') push('operator', '*', start, position);
      else if (FUNCTION_NAMES.has(word)) push('identifier', word, start, position);
      else if (/^[a-z]+$/u.test(word) && (word.length === 1 || !/^\s*[([{]/u.test(input.slice(position)))) {
        for (let offset = 0; offset < word.length; offset++) {
          const letter = word[offset];
          push(letter === 'e' ? 'constant' : 'variable', letter, start + offset, start + offset + 1);
        }
      } else throw new MathError(`Неизвестное имя «${match[0]}». Переменная — одна буква от a до z; для произведения нескольких букв используйте ×.`, start, position - start);
      continue;
    }
    position++;
    if (operators[character]) push('operator', operators[character], start, position);
    else if ('([{'.includes(character)) push('lparen', character, start, position);
    else if (')]}'.includes(character)) push('rparen', character, start, position);
    else if (character === ',') push('comma', character, start, position);
    else throw new MathError(`Символ «${character}» не поддерживается.`, start);
  }
  tokens.push({ type: 'eof', value: '', start: input.length, end: input.length });
  return tokens;
}
