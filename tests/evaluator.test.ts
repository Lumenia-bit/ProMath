import { describe, expect, it } from 'vitest';
import { solve } from '../src/math';
import { MathError } from '../src/math/errors';

describe('evaluator: exact arithmetic and precedence', () => {
  it.each([
    ['2 + 2', '4'],
    ['2 + 3 * 4', '14'],
    ['(2 + 3) * 4', '20'],
    ['2^3^2', '512'],
    ['-2^2', '-4'],
    ['(-2)^2', '4'],
    ['2^-3', '1/8'],
    ['2^3!', '64'],
    ['sqrt(16)', '4'],
    ['5!', '120'],
    ['0!', '1'],
    ['1/2 + 1/3', '5/6'],
    ['1/3 + 1/6', '1/2'],
    ['0.1 + 0.2', '3/10'],
    ['1/2 - 1/3', '1/6'],
    ['(2/3)*(9/4)', '3/2'],
    ['(2/3)/(4/9)', '3/2'],
    ['2(3+4)', '14'],
    ['(2+3)(4+5)', '45'],
    ['[2+{3*4}]', '14'],
    ['1.5e8', '150000000'],
    ['3.2e-5', '1/31250'],
    ['9007199254740993+1', '9007199254740994'],
    ['10%3', '1'],
    ['mod(5.5,2)', '3/2'],
    ['mod(-5,3)', '-2'],
    ['square(5)', '25'],
    ['abs(-7/3)', '7/3'],
    ['frac(18,24)', '3/4'],
    ['mixed(2,1,3)', '7/3'],
    ['mixed(-2,1,3)', '-7/3'],
  ])('%s = %s', (input, expected) => {
    expect(solve(input).exact).toBe(expected);
  });

  it('formats decimal approximations without binary floating point artifacts', () => {
    expect(solve('0.1+0.2').approximate).toBe('0.3');
    expect(solve('1/3').approximate).toBe('0.3333333333');
    expect(solve('sqrt(2)').approximate).toBe('1.4142135624');
  });

  it('retains non-rational expressions and readable LaTeX', () => {
    expect(solve('sqrt(2)').exact).toBe('sqrt(2)');
    expect(solve('sqrt(2)').latex).toBe('\\sqrt{2}');
    expect(solve('pi').exact).toBe('pi');
    expect(solve('e').exact).toBe('e');
    expect(Number(solve('pi').approximate)).toBeCloseTo(Math.PI, 9);
  });
});

describe('roots and powers', () => {
  it.each([
    ['sqrt(9/16)', '3/4'], ['sqrt(72)', '6 * sqrt(2)'],
    ['cbrt(27)', '3'], ['cbrt(-8)', '-2'],
    ['root(81,4)', '3'], ['root(-32,5)', '-2'],
    ['root(1/64,3)', '1/4'], ['16^(1/2)', '4'],
    ['(-8)^(2/3)', '4'], ['0^(1e-1000)', '0'],
  ])('%s = %s', (input, expected) => {
    expect(solve(input).exact.replace(/\s+/g, '')).toBe(expected.replace(/\s+/g, ''));
  });
});

describe('percentages', () => {
  it.each([
    ['20%', '1/5'], ['20% от 500', '100'], ['20% of 500', '100'],
    ['500+20%', '600'], ['500-20%', '400'], ['500*20%', '100'],
    ['500/20%', '2500'], ['500+(10+10)%', '600'],
  ])('%s = %s', (input, expected) => {
    expect(solve(input).exact).toBe(expected);
  });
});

describe('logarithms and trigonometry', () => {
  it.each([
    ['log(100)', '2'], ['log(8,2)', '3'], ['ln(1)', '0'], ['ln(e)', '1'],
  ])('%s = %s', (input, expected) => {
    expect(solve(input).exact).toBe(expected);
  });

  it('uses the selected angle mode independently for each calculation', () => {
    expect(solve('sin(30)', { angleMode: 'DEG' }).exact).toBe('1/2');
    expect(solve('sin(pi/2)', { angleMode: 'RAD' }).exact).toBe('1');
    expect(Number(solve('sin(30)', { angleMode: 'RAD' }).approximate)).toBeCloseTo(Math.sin(30), 9);
    expect(solve('sin(30)', { angleMode: 'DEG' }).angleMode).toBe('DEG');
    expect(solve('sin(pi/6+pi/3)', { angleMode: 'RAD' }).exact).toBe('1');
  });

  it.each([
    ['cos(60)', '1/2'], ['tan(45)', '1'], ['cot(45)', '1'],
    ['asin(1/2)', '30'], ['acos(1/2)', '60'], ['atan(1)', '45'],
  ])('DEG: %s = %s', (input, expected) => {
    expect(solve(input, { angleMode: 'DEG' }).exact).toBe(expected);
  });

  it('preserves exact special-angle radicals', () => {
    expect(Number(solve('sin(45)', { angleMode: 'DEG' }).approximate)).toBeCloseTo(Math.SQRT1_2, 9);
    expect(solve('sin(45)', { angleMode: 'DEG' }).exact).toContain('sqrt(2)');
  });
});

describe('combinatorics and number theory', () => {
  it.each([
    ['nCr(5,2)', '10'], ['nPr(5,2)', '20'], ['nCr(0,0)', '1'], ['nPr(0,0)', '1'],
    ['nCr(100,50)', '100891344545564193334812497256'],
    ['gcd(12,18)', '6'], ['gcd(-12,18)', '6'], ['gcd(0,18)', '18'],
    ['lcm(12,18)', '36'], ['lcm(-12,18)', '36'], ['lcm(0,18)', '0'],
  ])('%s = %s', (input, expected) => {
    expect(solve(input).exact).toBe(expected);
  });
});

describe('human-readable domain errors', () => {
  it.each([
    ['1/0', /ноль|нул/i],
    ['sqrt(-1)', /кор|отриц/i],
    ['5+', /ожида|выражен|оператор/i],
    ['((2+3)', /скоб/i],
    ['(-1)!', /цел|неотриц/i],
    ['factorial(-1)', /цел|неотриц/i],
    ['(1/2)!', /цел/i],
    ['log(0)', /полож/i],
    ['ln(-1)', /полож/i],
    ['log(2,1)', /основан/i],
    ['root(-16,2)', /кор|отриц/i],
    ['root(16,0)', /кор|степен|нул/i],
    ['asin(2)', /интервал|диапазон|\[-1|от −1|от -1/i],
    ['nCr(2,3)', /n|цел|превыш|меньше/i],
    ['gcd(1.5,3)', /цел/i],
    ['sqrt(1,2)', /аргумент/i],
  ])('%s', (input, message) => {
    expect(() => solve(input)).toThrow(MathError);
    expect(() => solve(input)).toThrow(message);
  });

  it('rejects tangent and cotangent poles in DEG mode', () => {
    expect(() => solve('tan(90)', { angleMode: 'DEG' })).toThrow(MathError);
    expect(() => solve('cot(0)', { angleMode: 'DEG' })).toThrow(MathError);
  });
});
