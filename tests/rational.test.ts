import { describe, expect, it } from 'vitest';
import { Rational, bigintGcd } from '../src/math/rational';

const rational = (value: string) => Rational.fromString(value);

describe('Rational: exact bigint arithmetic', () => {
  it('normalizes signs and reduces fractions', () => {
    const value = new Rational(18n, -24n);
    expect(value.numerator).toBe(-3n);
    expect(value.denominator).toBe(4n);
    expect(new Rational(-18n, -24n).toString()).toBe('3/4');
    expect(new Rational(0n, 999n).toString()).toBe('0');
  });

  it('keeps decimal and scientific literals exact', () => {
    expect(rational('0.1').add(rational('0.2')).toString()).toBe('3/10');
    expect(rational('1.2e-5').toString()).toBe('3/250000');
    expect(rational('1.5e8').toString()).toBe('150000000');
    expect(rational('0.001').toString()).toBe('1/1000');
  });

  it('adds, subtracts, multiplies and divides without floating point', () => {
    const a = new Rational(1n, 3n);
    const b = new Rational(1n, 6n);
    expect(a.add(b).toString()).toBe('1/2');
    expect(a.subtract(b).toString()).toBe('1/6');
    expect(a.multiply(b).toString()).toBe('1/18');
    expect(a.divide(b).toString()).toBe('2');
    expect(a.toString()).toBe('1/3');
  });

  it('supports positive, negative and zero integer powers', () => {
    const value = new Rational(-2n, 3n);
    expect(value.pow(3).toString()).toBe('-8/27');
    expect(value.pow(-2).toString()).toBe('9/4');
    expect(value.pow(0).toString()).toBe('1');
  });

  it('computes a remainder using truncation toward zero', () => {
    expect(rational('5.5').modulo(rational('2')).toString()).toBe('3/2');
    expect(rational('-5').modulo(rational('3')).toString()).toBe('-2');
  });

  it('handles integer checks, equality, absolute values and approximation', () => {
    const value = new Rational(-4n, 6n);
    expect(value.abs().toString()).toBe('2/3');
    expect(value.negate().toString()).toBe('2/3');
    expect(value.equals(new Rational(-2n, 3n))).toBe(true);
    expect(value.isInteger).toBe(false);
    expect(new Rational(6n, 3n).isInteger).toBe(true);
    expect(value.toNumber()).toBeCloseTo(-2 / 3, 14);
  });

  it('rejects division and a denominator of zero', () => {
    expect(() => new Rational(1n, 0n)).toThrow();
    expect(() => rational('1').divide(rational('0'))).toThrow();
    expect(() => rational('1').modulo(rational('0'))).toThrow();
  });

  it('uses Euclid’s algorithm for all sign combinations and zero', () => {
    expect(bigintGcd(12n, 18n)).toBe(6n);
    expect(bigintGcd(-12n, 18n)).toBe(6n);
    expect(bigintGcd(0n, 18n)).toBe(18n);
    expect(bigintGcd(0n, 0n)).toBe(0n);
  });

  it('preserves values beyond the safe integer range', () => {
    const value = rational('9007199254740993');
    expect(value.add(rational('1')).toString()).toBe('9007199254740994');
    expect(value.subtract(rational('9007199254740992')).toString()).toBe('1');
  });

  it('maintains reduced-form arithmetic invariants over unlike denominators', () => {
    const samples = [new Rational(7n, 15n), new Rational(-13n, 21n), new Rational(11n, 18n), new Rational(19n, 35n)];
    for (const a of samples) for (const b of samples) {
      expect(a.add(b).subtract(b).equals(a)).toBe(true);
      expect(a.multiply(b).divide(b).equals(a)).toBe(true);
      const result = a.add(b);
      expect(bigintGcd(result.numerator, result.denominator)).toBe(1n);
      expect(result.denominator).toBeGreaterThan(0n);
    }
  });
});
