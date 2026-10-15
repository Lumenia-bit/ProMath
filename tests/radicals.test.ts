import { describe, expect, it } from 'vitest';
import { solve } from '../src/math';

describe('exact radical identities', () => {
  it.each([
    ['sqrt(8)^2', '8'],
    ['sqrt(2) * sqrt(8)', '4'],
    ['sqrt(18) / sqrt(2)', '3'],
    ['sqrt(8) - 2sqrt(2)', '0'],
    ['cbrt(2)^3', '2'],
    ['cbrt(-2)^3', '-2'],
    ['(1/sqrt(2))^2', '1/2'],
    ['(-sqrt(2))^2', '2'],
  ])('%s gives exact %s', (expression, exact) => {
    expect(solve(expression).exact).toBe(exact);
  });

  it('keeps trigonometric squares exact', () => {
    expect(solve('sin(45)^2+cos(45)^2', { angleMode: 'DEG' }).exact).toBe('1');
    expect(solve('asin(1/sqrt(2))', { angleMode: 'DEG' }).exact).toBe('45');
  });

  it('recognizes exact opposite symbolic values before checking approximate underflow', () => {
    expect(solve('pi+(-pi)').exact).toBe('0');
    expect(solve('-pi+pi').exact).toBe('0');
    expect(solve('e-100%').exact).toBe('0');
    expect(solve('pi+(-100)%').exact).toBe('0');
  });
});

describe('solution output budget', () => {
  it('rejects oversized generated explanations before they reach the UI', () => {
    expect(() => solve(Array(50).fill('1000!').join('+'))).toThrow(/решение слишком объёмное/);
  });

  it('still allows a single bounded factorial', () => {
    expect(solve('1000!').exact).toHaveLength(2568);
  });
});
