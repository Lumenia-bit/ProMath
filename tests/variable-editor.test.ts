import { describe, expect, it } from 'vitest';
import { expressionToLatex, latexToExpression } from '../src/editor/latex';
import { MathError, parse, solve } from '../src/math';
import { tokenizeLatex } from '../src/editor/latex-tokens';

const letters = Array.from({ length: 26 }, (_, index) => String.fromCharCode(97 + index));
const compact = (expression: string) => expression.replace(/\s+/g, '');

describe('visual editor: unknown letters', () => {
  it.each(letters)('uses a typed variable for the visible letter %s', letter => {
    const expression = latexToExpression(letter);
    expect(parse(expression)).toMatchObject({ type: 'variable', name: letter });
    expect(solve(expression).unresolvedVariables).toEqual([letter]);
    expect(solve(expression).approximate).toBe('');
    expect(tokenizeLatex(letter)[0]).toMatchObject({ kind: 'variable', value: letter });
  });

  it.each([
    String.raw`\frac{x}{y}`, String.raw`\sqrt{x}`, String.raw`x^{y}`,
    String.raw`\sqrt[n]{x}`, String.raw`\sin\left(x\right)`,
    String.raw`\log_{b}\left(x\right)`, String.raw`\left|a\right|`,
    String.raw`\binom{n}{r}`, String.raw`x!`,
  ])('keeps unknown letters in editable cells: %s', latex => {
    const expression = latexToExpression(latex);
    const result = solve(expression);
    expect(result.unresolvedVariables?.length).toBeGreaterThan(0);
    expect(result.approximate).toBe('');
    expect(result.exact).not.toMatch(/NaN|undefined|Infinity/);
  });

  it.each([
    [String.raw`\frac{x}{2}+\frac{x}{3}`, { x: '6' }, '5'],
    [String.raw`\sqrt{x}`, { x: '16' }, '4'],
    [String.raw`\sqrt[n]{x}`, { x: '81', n: '4' }, '3'],
    [String.raw`x^{y}`, { x: '2', y: '3' }, '8'],
    [String.raw`\log_{b}\left(x\right)`, { b: '2', x: '8' }, '3'],
    [String.raw`\binom{n}{r}`, { n: '5', r: '2' }, '10'],
    [String.raw`\left|x\right|`, { x: '-3' }, '3'],
  ])('substitutes values into visual formula %s', (latex, variables, expected) => {
    expect(solve(latexToExpression(latex), { variables }).exact).toBe(expected);
  });

  it('retains implicit multiplication between adjacent unknown letters', () => {
    expect(parse(latexToExpression('xy'))).toMatchObject({ type: 'binary', operator: '*', left: { type: 'variable', name: 'x' }, right: { type: 'variable', name: 'y' } });
    expect(solve(latexToExpression('2xy+3yx'), { variables: { x: '2', y: '3' } }).exact).toBe('30');
    expect(solve(latexToExpression('xyz'), { variables: { x: '2', y: '3', z: '4' } }).exact).toBe('24');
    expect(solve(latexToExpression('abc'), { variables: { a: '2', b: '3', c: '4' } }).exact).toBe('24');
  });

  it('distinguishes italic e from the Euler constant', () => {
    expect(parse(latexToExpression('e'))).toMatchObject({ type: 'variable', name: 'e' });
    expect(parse(latexToExpression(String.raw`\mathit{e}`))).toMatchObject({ type: 'variable', name: 'e' });
    expect(parse(latexToExpression(String.raw`\mathnormal{e}`))).toMatchObject({ type: 'variable', name: 'e' });
    for (const latex of [String.raw`\exponentialE`, String.raw`\mathrm{e}`]) {
      expect(parse(latexToExpression(latex))).toMatchObject({ type: 'constant', name: 'e' });
      expect(solve(latexToExpression(latex)).exact).toBe('e');
    }
    expect(expressionToLatex('var(e)')).not.toBe(expressionToLatex('e'));
  });

  it('preserves scientific notation without reinterpreting its e as an unknown', () => {
    expect(solve(latexToExpression('1.2e-5')).exact).toBe('3/250000');
    expect(solve(latexToExpression(String.raw`1.2\times10^{-5}`)).exact).toBe('3/250000');
  });

  it('retains source spans for variables nested in fraction cells', () => {
    const latex = String.raw`\frac{x}{y}`;
    const tokens = tokenizeLatex(latex).filter(token => token.kind === 'variable');
    expect(tokens.map(token => latex.slice(token.start, token.end))).toEqual(['x', 'y']);
  });
});

describe('visual editor: symbolic expression round-trip', () => {
  it.each([
    'a+b', '2x+3x', 'x/2+x/3', 'xy+yx', 'x^2', 'x^y',
    'sqrt(x)', 'root(x,n)', 'sin(x)', 'log(x,b)', 'abs(x)',
    'nCr(n,r)', 'gcd(a,b)', 'x!', 'x%', 'var(e)+e', 'ln(e)',
    '1/(x+1)', '(x+y)^2', '2(x+1)', 'sin(pi/2)+a',
  ])('round-trips %s', expression => {
    const converted = latexToExpression(expressionToLatex(expression));
    const before = solve(expression);
    const after = solve(converted);
    expect(compact(after.exact)).toBe(compact(before.exact));
    expect(after.unresolvedVariables).toEqual(before.unresolvedVariables);
    expect(after.approximate).toBe(before.approximate);
  });

  it('keeps unknowns inside fraction, radical, exponent and log-base cells', () => {
    expect(expressionToLatex('x/y')).toContain(String.raw`\frac{x}{y}`);
    expect(expressionToLatex('sqrt(x)')).toContain(String.raw`\sqrt{x}`);
    expect(expressionToLatex('root(x,n)')).toContain(String.raw`\sqrt[n]{x}`);
    expect(expressionToLatex('x^y')).toContain('^{y}');
    expect(expressionToLatex('log(x,b)')).toContain(String.raw`\log_{b}`);
  });

  it.each([
    String.raw`\unknown{x}`, String.raw`\operatorname{alert}(x)`,
    String.raw`\text{x}`, String.raw`\href{javascript:alert(1)}{x}`,
    String.raw`\def\x{1}\x`, 'window.location', 'constructor(1)',
  ])('still rejects unsupported commands or executable-looking input: %s', latex => {
    expect(() => latexToExpression(latex)).toThrow(MathError);
  });
});
