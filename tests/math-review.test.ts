import { describe, expect, it } from 'vitest';
import { formatAST, parse, solve, tokenize } from '../src/math';
import { MathError } from '../src/math/errors';
import { Rational } from '../src/math/rational';
import { numeric } from '../src/math/value';
import type { Solution } from '../src/math/types';

function resolvedNumber(value: Solution['value']): number {
  if (!(value instanceof Rational) && value.kind === 'unresolved') throw new Error('Expected a fully resolved numerical result.');
  return numeric(value);
}

describe('independent numerical and resource regressions', () => {
  it('converts huge coprime numerator and denominator without Infinity/Infinity', () => {
    const scale = 10n ** 1000n;
    expect(new Rational(scale + 1n, scale + 3n).toNumber()).toBeCloseTo(1, 14);
    expect(new Rational(-(scale + 1n), scale + 3n).toNumber()).toBeCloseTo(-1, 14);
    expect(new Rational(10n ** 309n, 7n).toNumber()).toBeCloseTo(1.4285714285714286e308, -294);
  });

  it('keeps near-unity logarithms numerically meaningful', () => {
    const result = solve('ln(1.000000000000001)');
    const approximate = Number(result.approximate);
    expect(Math.abs(approximate / Math.log1p(1e-15) - 1)).toBeLessThan(1e-9);
  });

  it('accepts valid logarithm bases close to one', () => {
    const approximate = Number(solve('log(2,1.000000000000001)').approximate);
    expect(Math.abs(approximate / (Math.log(2) / Math.log1p(1e-15)) - 1)).toBeLessThan(1e-9);
  });

  it('accepts finite cotangents near a pole rather than declaring a domain error', () => {
    const approximate = Number(solve('cot(1e-14)', { angleMode: 'DEG' }).approximate);
    const radians = 1e-14 * Math.PI / 180;
    expect(Math.abs(approximate / (Math.cos(radians) / Math.sin(radians)) - 1)).toBeLessThan(1e-9);
  });

  it('bounds generated radical size before multiplying large radicands', () => {
    expect(() => solve('sqrt(((1e1000+1)^4+1)/((1e1000+3)^4+1))')).toThrow(MathError);
  });

  it('bounds lcm intermediate products', () => {
    expect(() => solve('lcm((1e1000+1)^4,(1e1000+3)^4)')).toThrow(MathError);
  });

  it('preserves the grouping of contextual percentages when formatting', () => {
    const input = '500+(10%+20%)';
    expect(solve(input).exact).toBe('12503/25');
    expect(solve(formatAST(parse(input))).exact).toBe(solve(input).exact);
  });

  it('keeps negative relative percentages equivalent through all displayed steps', () => {
    const result = solve('500+(-20)%');
    expect(result.exact).toBe('400');
    for (const step of result.steps.filter(item => item.type === 'operation')) {
      expect(solve(step.before).exact).toBe('400');
      expect(solve(step.after).exact).toBe('400');
    }
  });

  it.each(['1e+-2', '1e--2', '1e++2', '1e2e3'])('rejects malformed scientific notation: %s', (input) => {
    expect(() => tokenize(input)).toThrow(MathError);
  });

  it('allows an implicit Euler constant without an exponent suffix', () => {
    expect(solve('2e').exact).toContain('e');
    expect(solve('1e2').exact).toBe('100');
  });

  it.each([
    '1+(2+3)', '1-(2-3)', '(2^3)^2', '2^(3^2)', '-2^2', '(-2)^3',
    '1/(2/3)', '(1/2)/3', '2*(3/4)', '2*(5%3)', '(2+3)%',
    '500+(10%+20%)', '500+(-20)%', '500+(20%*2)', '500+(10+10)%',
    '500+(-20%)', '20% of 500', '20%*500+10%', '500+(20%+30)',
    '500+(20%+(-30)%)',
  ])('keeps displayed expression and step snapshots equivalent: %s', (input) => {
    const result = solve(input);
    expect(solve(formatAST(result.ast)).exact).toBe(result.exact);
    for (const step of result.steps.filter(item => item.type === 'operation')) {
      expect(solve(step.before).exact).toBe(result.exact);
      expect(solve(step.after).exact).toBe(result.exact);
    }
  });

  it('rejects a negative symbolic radicand even if its magnitude underflows', () => {
    expect(() => solve('sqrt(-e^-1000)')).toThrow(MathError);
  });

  it('keeps a zero base exact for positive symbolic exponents', () => {
    expect(solve('0^pi').exact).toBe('0');
    expect(solve('0^e').exact).toBe('0');
  });

  it.each([
    ['pi+(sqrt(2)+20%)', Math.PI + 1.2 * Math.SQRT2],
    ['500+(sqrt(2)+20%)', 500 + 1.2 * Math.SQRT2],
    ['500+(20%+sqrt(2))', 500.2 + Math.SQRT2],
    ['pi+(10%+20%)', Math.PI + 0.12],
    ['pi+20%', 1.2 * Math.PI],
    ['sqrt(2)+(-20)%', 0.8 * Math.SQRT2],
  ])('preserves symbolic relative percentage semantics in all snapshots: %s', (input, expected) => {
    const result = solve(input);
    expect(resolvedNumber(result.value)).toBeCloseTo(expected, 12);
    expect(solve(formatAST(result.ast)).exact).toBe(result.exact);
    for (const step of result.steps.filter(item => item.type === 'operation')) {
      expect(resolvedNumber(solve(step.before).value)).toBeCloseTo(expected, 12);
      expect(resolvedNumber(solve(step.after).value)).toBeCloseTo(expected, 12);
    }
  });
});
