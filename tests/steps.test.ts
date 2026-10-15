import { describe, expect, it } from 'vitest';
import { solve } from '../src/math';

describe('step generator', () => {
  it('evaluates a nested expression from the innermost operation outward', () => {
    const solution = solve('2+3*sqrt(16)');
    const operations = solution.steps.map((step) => step.operation).join('\n');
    expect(operations.indexOf('sqrt(16)')).toBeGreaterThanOrEqual(0);
    expect(operations.indexOf('sqrt(16)')).toBeLessThan(operations.indexOf('3 * 4'));
    expect(operations.indexOf('3 * 4')).toBeLessThan(operations.indexOf('2 + 12'));
    expect(solution.steps.at(-1)?.after).toBe('14');
  });

  it('explains common denominators with generated fraction conversions', () => {
    const solution = solve('1/2+1/3');
    const text = solution.steps.map((step) => [step.operation, step.explanation].join(' ')).join('\n');
    expect(text).toMatch(/НОК/);
    expect(text).toContain('3/6');
    expect(text).toContain('2/6');
    expect(text).toContain('5/6');
    expect(solution.steps.some((step) => step.type === 'fraction')).toBe(true);
  });

  it('derives denominator conversions from unrelated input', () => {
    const solution = solve('2/5+3/7');
    const text = solution.steps.map((step) => [step.operation, step.explanation].join(' ')).join('\n');
    expect(text).toContain('35');
    expect(text).toContain('14/35');
    expect(text).toContain('15/35');
    expect(solution.exact).toBe('29/35');
  });

  it('provides complete structured explanations and renderable formulas', () => {
    const solution = solve('(2+3)*4');
    expect(solution.steps.length).toBeGreaterThanOrEqual(2);
    for (const step of solution.steps) {
      expect(['operation', 'simplification', 'fraction', 'result']).toContain(step.type);
      expect(step.before).not.toBe('');
      expect(step.operation).not.toBe('');
      expect(step.after).not.toBe('');
      expect(step.explanation).not.toBe('');
      expect(step.beforeLatex).not.toBe('');
      expect(step.operationLatex).not.toBe('');
      expect(step.afterLatex).not.toBe('');
    }
  });

  it('returns a final exact result for an expression with no reducible operation', () => {
    const solution = solve('sqrt(2)');
    expect(solution.steps.at(-1)?.after).toBe(solution.exact);
    expect(solution.steps.at(-1)?.type).toBe('result');
  });
});
