import { describe, expect, it } from 'vitest';
import { expressionToLatex, latexToExpression } from '../src/editor/latex';
import { tokenizeLatex } from '../src/editor/latex-tokens';
import { MathError, parse, solve } from '../src/math';
import { LIMITS } from '../src/math/limits';

function exactFromLatex(latex: string, angleMode: 'RAD' | 'DEG' = 'RAD'): string {
  return solve(latexToExpression(latex), { angleMode }).exact;
}

describe('visual editor: mathematical cells become engine expressions', () => {
  it.each([
    [String.raw`\frac{1}{2}+\frac{1}{3}`, '5/6'],
    [String.raw`\frac12`, '1/2'],
    [String.raw`\frac1{23}`, '1/23'],
    [String.raw`\frac{12}3`, '4'],
    [String.raw`\frac123`, '3/2'],
    [String.raw`\frac{-1}2`, '-1/2'],
    [String.raw`\frac12+\frac13`, '5/6'],
    [String.raw`\frac23^2`, '4/9'],
    [String.raw`\dfrac{2+3}{4-1}`, '5/3'],
    [String.raw`\tfrac{\frac{1}{2}}{\frac{3}{4}}`, '2/3'],
    [String.raw`\frac{1}{2+\frac{1}{3}}`, '3/7'],
    [String.raw`\sqrt{16}`, '4'],
    [String.raw`\sqrt[3]{-8}`, '-2'],
    [String.raw`\sqrt[4]{81}`, '3'],
    [String.raw`\sqrt[3]8`, '2'],
    [String.raw`\sqrt23`, '3 * sqrt(2)'],
    [String.raw`\frac1{\frac23}`, '3/2'],
    [String.raw`\frac1\frac23`, '3/2'],
    [String.raw`\sqrt{\frac{9}{16}}`, '3/4'],
    [String.raw`\frac{2^{3}}{\sqrt{16}}`, '2'],
    [String.raw`2^{3^{2}}`, '512'],
    [String.raw`-2^{2}`, '-4'],
    [String.raw`\left(-2\right)^{2}`, '4'],
    [String.raw`2^{-3}`, '1/8'],
    [String.raw`2^23`, '12'],
    [String.raw`2^{23}`, '8388608'],
    [String.raw`2^{3!}`, '64'],
    [String.raw`2^{3}!`, '40320'],
    [String.raw`\left(2+3\right)\left(4+5\right)`, '45'],
    [String.raw`\left[2+3\right]\cdot4`, '20'],
    [String.raw`5!`, '120'],
    [String.raw`\left|-\frac{7}{3}\right|`, '7/3'],
    [String.raw`\left|\left|-2\right|-3\right|`, '1'],
    [String.raw`\binom{5}{2}`, '10'],
    [String.raw`\binom52`, '10'],
    [String.raw`\operatorname{nPr}\left(5,2\right)`, '20'],
    [String.raw`\operatorname{gcd}\left(12,18\right)`, '6'],
    [String.raw`\operatorname{lcm}\left(12,18\right)`, '36'],
    [String.raw`\log\left(100\right)`, '2'],
    [String.raw`\log_{2}\left(8\right)`, '3'],
    [String.raw`\log_2\left(8\right)`, '3'],
    [String.raw`\log_28`, '3'],
    [String.raw`\ln\left(\exponentialE\right)`, '1'],
    [String.raw`\sin\left(\frac{\pi}{2}\right)`, '1'],
    [String.raw`\sin2\pi`, '0'],
    [String.raw`1.5\times10^{8}`, '150000000'],
    [String.raw`3.2\times10^{-5}`, '1/31250'],
    [String.raw`10\bmod3`, '1'],
    [String.raw`10\div4`, '5/2'],
  ])('%s evaluates to %s', (latex, expected) => {
    expect(exactFromLatex(latex)).toBe(expected);
  });

  it.each([
    [String.raw`\sin\left(30\right)`, '1/2'],
    [String.raw`\cos\left(60\right)`, '1/2'],
    [String.raw`\tan\left(45\right)`, '1'],
    [String.raw`\cot\left(45\right)`, '1'],
    [String.raw`\arcsin\left(\frac{1}{2}\right)`, '30'],
    [String.raw`\arccos\left(\frac{1}{2}\right)`, '60'],
    [String.raw`\arctan\left(1\right)`, '45'],
    [String.raw`\sin^{2}\left(30\right)`, '1/4'],
    [String.raw`\sin^230`, '1/4'],
    [String.raw`\sin30`, '1/2'],
    [String.raw`\arcsin\frac{1}{2}`, '30'],
    [String.raw`\sin^{-1}\left(\frac{1}{2}\right)`, '30'],
    [String.raw`\cos^{-1}\left(\frac{1}{2}\right)`, '60'],
    [String.raw`\tan^{-1}\left(1\right)`, '45'],
    [String.raw`\sin\left(30\right)^{-1}`, '2'],
    [String.raw`\sin-30`, '-1/2'],
  ])('respects DEG mode for %s', (latex, expected) => {
    expect(exactFromLatex(latex, 'DEG')).toBe(expected);
  });

  it.each([
    [String.raw`20\%`, '1/5'],
    [String.raw`500+20\%`, '600'],
    [String.raw`500-20\%`, '400'],
    [String.raw`500\times20\%`, '100'],
    [String.raw`500\div20\%`, '2500'],
    [String.raw`500+\left(10+10\right)\%`, '600'],
    [String.raw`500+2^{3}\%`, '540'],
    [String.raw`500+\frac{1}{2}\%`, '1005/2'],
    [String.raw`500+\frac12\%`, '1005/2'],
  ])('preserves percentage context in %s', (latex, expected) => {
    expect(exactFromLatex(latex)).toBe(expected);
  });

  it('preserves constants symbolically', () => {
    expect(exactFromLatex(String.raw`\pi`)).toBe('pi');
    expect(exactFromLatex(String.raw`\exponentialE`)).toBe('e');
    expect(exactFromLatex(String.raw`\mathrm{e}`)).toBe('e');
    expect(exactFromLatex(String.raw`\sqrt{2}`)).toBe('sqrt(2)');
  });

  it('treats a rendered mixed number as an addition, including its sign', () => {
    expect(exactFromLatex(String.raw`2\,\frac{1}{3}`)).toBe('7/3');
    expect(exactFromLatex(String.raw`-2\,\frac{1}{3}`)).toBe('-7/3');
    expect(exactFromLatex(String.raw`-2\,\frac{1}{3}+1`)).toBe('-4/3');
  });
});

describe('visual editor: engine expressions round-trip without changing mathematics', () => {
  it.each([
    '2+3*sqrt(16)', '1/2+1/3', '(2/3)/(4/9)', '1/(2+1/3)',
    '2^3^2', '(2^3)^2', '-2^2', '(-2)^2', '2^-3', '2^3!',
    'sqrt(2)', 'cbrt(-8)', 'root(81,4)', 'root(16,1+3)',
    'abs(-7/3)', 'nCr(5,2)', 'nPr(5,2)', 'gcd(12,18)', 'lcm(12,18)',
    'log(8,2)', 'ln(e)', 'sin(pi/2)', 'asin(1/2)',
    'square(1.5e2)', 'square(2^3)', 'log(64,2+2)',
    '0.1+0.2', '1.5e8', '3.2e-5', '2pi',
    '1.5e2^2', '-1.5e2^2', '2e1!', '500+2e1%',
    '500+20%', '500-(10+10)%', '500*20%', '10%3',
    '2*(8%3)', '(8%3)*2', '8%(5%3)',
    'mixed(2,1,3)', 'mixed(-2,1,3)', 'frac(18,24)',
    'mixed(-0,1,3)', 'mixed(2,1,3)^2', '2*mixed(-2,1,3)',
    'mixed(2,1,3)+mixed(-2,1,3)', '1/mixed(-2,1,3)',
  ])('round-trips %s', (expression) => {
    const expected = solve(expression);
    const result = solve(latexToExpression(expressionToLatex(expression)));
    expect(result.exact).toBe(expected.exact);
    expect(result.approximate).toBe(expected.approximate);
  });

  it('renders fraction, radical, exponent, and base cells in LaTeX', () => {
    expect(expressionToLatex('1/2')).toContain(String.raw`\frac{1}{2}`);
    expect(expressionToLatex('sqrt(2)')).toContain(String.raw`\sqrt{2}`);
    expect(expressionToLatex('root(81,4)')).toContain(String.raw`\sqrt[4]{81}`);
    expect(expressionToLatex('2^3')).toContain('^{3}');
    expect(expressionToLatex('log(8,2)')).toContain(String.raw`\log_{2}`);
  });

  it('returns ordinary engine grammar rather than executable code', () => {
    const expression = latexToExpression(String.raw`\frac{1}{2}+\sqrt{16}`);
    expect(() => parse(expression)).not.toThrow();
    expect(expression).not.toContain('\\');
  });
});

describe('visual editor: incomplete and unsupported input is rejected safely', () => {
  it.each([
    '', String.raw`\frac{}{2}`, String.raw`\frac{1}{}`, String.raw`\sqrt{}`,
    String.raw`\sqrt[]{2}`, String.raw`\frac{\placeholder{}}{2}`,
    String.raw`\placeholder{}`, String.raw`2^{}`, String.raw`\log_{}(8)`,
    String.raw`\frac{1}{2`, String.raw`\sqrt{2`, String.raw`\left(2+3`,
    String.raw`\unknown{2}`, String.raw`\operatorname{alert}(1)`,
    String.raw`\text{alert(1)}`, String.raw`\href{javascript:alert(1)}{2}`,
    String.raw`\htmlData{onclick=alert(1)}{2}`, String.raw`\def\x{1}\x`,
    String.raw`\begin{matrix}1&2\end{matrix}`, 'constructor.constructor(1)',
  ])('rejects %s with a human-readable mathematical error', (latex) => {
    expect(() => latexToExpression(latex)).toThrow(MathError);
    try {
      latexToExpression(latex);
    } catch (error) {
      expect((error as Error).message).not.toMatch(/SyntaxError|RangeError|undefined/);
    }
  });

  it('keeps mathematical domain validation in the engine', () => {
    expect(() => solve(latexToExpression(String.raw`\frac{1}{0}`))).toThrow(/ноль|нул/);
    expect(() => solve(latexToExpression(String.raw`\sqrt{-1}`))).toThrow(/кор|отриц/);
    expect(() => solve(latexToExpression(String.raw`\left(-1\right)!`))).toThrow(/цел|неотриц/);
  });

  it('limits LaTeX length before parsing', () => {
    expect(() => latexToExpression('1'.repeat(10_001))).toThrow(MathError);
  });

  it.each([String.raw`\constructor(1)`, String.raw`\toString(1)`, String.raw`\hasOwnProperty(1)`])('rejects inherited names in the closed command vocabulary: %s', (latex) => {
    expect(() => tokenizeLatex(latex)).toThrow(MathError);
  });

  it('limits recursively nested cells', () => {
    const depth = LIMITS.depth + 10;
    const input = String.raw`\sqrt{`.repeat(depth) + '1' + '}'.repeat(depth);
    expect(() => latexToExpression(input)).toThrow(MathError);
  });
});
