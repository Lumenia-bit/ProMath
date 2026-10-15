import { describe, expect, it } from 'vitest';
import { parse } from '../src/math/parser';
import { MathError } from '../src/math/errors';

describe('parser', () => {
  it('gives multiplication priority over addition', () => {
    expect(parse('2 + 3 * sqrt(16)')).toMatchObject({
      type: 'binary', operator: '+', left: { type: 'number', value: '2' },
      right: { type: 'binary', operator: '*', left: { type: 'number', value: '3' },
        right: { type: 'function', name: 'sqrt', args: [{ type: 'number', value: '16' }] } },
    });
  });

  it('makes powers right associative', () => {
    expect(parse('2^3^2')).toMatchObject({ type: 'binary', operator: '^',
      left: { type: 'number', value: '2' },
      right: { type: 'binary', operator: '^', left: { type: 'number', value: '3' },
        right: { type: 'number', value: '2' } },
    });
  });

  it('makes powers bind more tightly than unary minus', () => {
    expect(parse('-2^2')).toMatchObject({ type: 'unary', operator: '-',
      argument: { type: 'binary', operator: '^' } });
    expect(parse('2^-3')).toMatchObject({ type: 'binary', operator: '^',
      right: { type: 'unary', operator: '-', argument: { type: 'number', value: '3' } } });
  });

  it('gives factorial priority over powers', () => {
    expect(parse('2^3!')).toMatchObject({ type: 'binary', operator: '^',
      right: { type: 'factorial', argument: { type: 'number', value: '3' } } });
  });

  it.each(['2(3+4)', '(2+3)(4+5)', '2π', '3sin(2)'])
    ('inserts implicit multiplication for %s', (input) => {
      expect(parse(input)).toMatchObject({ type: 'binary', operator: '*' });
    });

  it('supports function argument lists and all bracket pairs', () => {
    expect(parse('gcd[12,{18}]')).toMatchObject({ type: 'function', name: 'gcd',
      args: [{ type: 'number', value: '12' }, { type: 'number', value: '18' }] });
  });

  it('distinguishes postfix percentage from remainder', () => {
    expect(parse('500+20%')).toMatchObject({ type: 'binary', operator: '+',
      right: { type: 'percentage', argument: { type: 'number', value: '20' } } });
    expect(parse('10%3')).toMatchObject({ type: 'binary', operator: '%' });
  });

  it.each(['5+', '((2+3)', '(2+3]', 'sqrt()', 'gcd(12,)', '2**3'])
    ('reports malformed expressions as MathError: %s', (input) => {
      expect(() => parse(input)).toThrow(MathError);
    });

  it('reports a source position near the invalid operator', () => {
    try {
      parse('2 × / 3');
      expect.fail('The invalid expression must be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(MathError);
      expect((error as MathError).position).toBeGreaterThanOrEqual(2);
      expect((error as MathError).position).toBeLessThanOrEqual(6);
      expect((error as MathError).length).toBeGreaterThan(0);
    }
  });
});
