import { describe, expect, it } from 'vitest';
import { solve } from '../src/math';
import { parse } from '../src/math/parser';
import { LIMITS } from '../src/math/limits';
import { MathError } from '../src/math/errors';

describe('resource and input safety', () => {
  it.each([
    'globalThis.alert(1)', 'constructor.constructor("return 1")()',
    '2; location.href="https://example.com"', 'import("x")', 'console.log(1)',
  ])('accepts only mathematical grammar: %s', (input) => {
    expect(() => solve(input)).toThrow(MathError);
  });

  it('limits input length before parsing', () => {
    expect(() => parse('1'.repeat(LIMITS.inputLength + 1))).toThrow(MathError);
  });

  it('limits nested parentheses and recursive unary expressions', () => {
    const count = LIMITS.depth + 10;
    expect(() => parse('('.repeat(count) + '1' + ')'.repeat(count))).toThrow(MathError);
    expect(() => parse('-'.repeat(count) + '1')).toThrow(MathError);
  });

  it('limits excessively large factorials and powers', () => {
    expect(() => solve(`${LIMITS.factorial + 1}!`)).toThrow(MathError);
    expect(() => solve(`2^${LIMITS.exponent + 1}`)).toThrow(MathError);
    expect(() => solve('2^(2^20)')).toThrow(MathError);
  });

  it('limits scientific exponents', () => {
    expect(() => solve(`1e${LIMITS.scientificExponent + 1}`)).toThrow(MathError);
  });

  it('enforces a node/token budget on a broad tree', () => {
    expect(() => parse(Array.from({ length: LIMITS.nodes + 5 }, () => '1').join('+'))).toThrow(MathError);
  });

  it('does not return NaN or infinity as a successful result', () => {
    expect(() => solve('e^1000')).toThrow(MathError);
  });

  it('can display huge exact rational values without an infinite approximation', () => {
    const solution = solve('1e1000');
    expect(solution.exact).toBe('1' + '0'.repeat(1000));
    expect(solution.approximate).not.toMatch(/Infinity|NaN/);
    expect(solve('1/(1e-1000)').exact).toBe(solution.exact);
    expect(solve('1e-1000').approximate).not.toBe('0');
  });
});
