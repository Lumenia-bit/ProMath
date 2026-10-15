import { describe, expect, it } from 'vitest';
import { tokenize } from '../src/math/tokenizer';
import { MathError } from '../src/math/errors';

describe('tokenizer', () => {
  it('recognizes integers, decimals and scientific notation', () => {
    const numbers = tokenize('123 + 12.5 + 0.001 + 1e10 + 1.2e-5')
      .filter((token) => token.type === 'number').map((token) => token.value);
    expect(numbers).toEqual(['123', '12.5', '0.001', '1e10', '1.2e-5']);
  });

  it('normalizes display glyphs and constants', () => {
    const tokens = tokenize('2 × π ÷ 3 − e');
    expect(tokens.filter((token) => token.type === 'operator').map((token) => token.value))
      .toEqual(['*', '/', '-']);
    expect(tokens.filter((token) => token.type === 'constant').map((token) => token.value))
      .toEqual(['pi', 'e']);
  });

  it('records exact source positions, including whitespace', () => {
    const tokens = tokenize(' 12 + sqrt(4)');
    expect(tokens[0]).toMatchObject({ type: 'number', value: '12', start: 1, end: 3 });
    expect(tokens.find((token) => token.value === 'sqrt'))
      .toMatchObject({ type: 'identifier', start: 6, end: 10 });
    expect(tokens.at(-1)).toMatchObject({ type: 'eof', start: 13, end: 13 });
  });

  it('retains all bracket kinds to validate matching pairs', () => {
    expect(tokenize('[2+{3*(4)}]').filter((token) => ['lparen', 'rparen'].includes(token.type))
      .map((token) => token.value)).toEqual(['[', '{', '(', ')', '}', ']']);
  });

  it('separates adjacent literals and functions for implicit multiplication', () => {
    expect(tokenize('2π 3sin(2)').filter((token) => token.type !== 'eof').map((token) => token.value))
      .toEqual(['2', 'pi', '3', 'sin', '(', '2', ')']);
  });

  it.each(['alert(1)', 'window.location', '2;3', '2&&3', '"2"', '2@3'])
    ('rejects non-mathematical input %s', (input) => {
      expect(() => tokenize(input)).toThrow(MathError);
    });
});
