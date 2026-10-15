import { describe, expect, it } from 'vitest';
import { latexToExpression } from '../src/editor/latex';
import { editorInsertion } from '../src/editor/templates';
import { MathError, parse, solve } from '../src/math';

function filledTemplate(text: string, selected: string, cells: string[]): string {
  const template = editorInsertion({ text });
  let index = 0;
  const latex = template.latex.replace(/#(?:0|@|\?)/g, token => token === '#?' ? cells[index++] : selected);
  return latexToExpression(latex);
}

describe('visual keyboard templates', () => {
  it.each([
    ['/', '6', ['3'], '2'],
    ['÷', '6', ['3'], '2'],
    ['frac(,)', '1', ['2'], '1/2'],
    ['sqrt()', '16', [], '4'],
    ['cbrt()', '-8', [], '-2'],
    ['root(,2)', '81', ['4'], '3'],
    ['^', '2', ['3'], '8'],
    ['^2', '3', [], '9'],
    ['abs()', '-7', [], '7'],
    ['log(,)', '8', ['2'], '3'],
    ['nCr(,)', '5', ['2'], '10'],
    ['nPr(,)', '5', ['2'], '20'],
    ['gcd(,)', '12', ['18'], '6'],
    ['lcm(,)', '12', ['18'], '36'],
    ['mod(,)', '10', ['3'], '1'],
    ['mixed(,,)', '2', ['1', '3'], '7/3'],
    ['e^()', '0', [], '1'],
    ['reciprocal()', '4', [], '1/4'],
    ['paren()', '2+3', [], '5'],
  ] as const)('inserts functioning cells for %s', (text, selected, cells, expected) => {
    expect(editorInsertion({ text }).selectionMode).toBe('placeholder');
    expect(solve(filledTemplate(text, selected, [...cells])).exact).toBe(expected);
  });

  it.each([
    ['sin()', '30', '1/2'], ['cos()', '60', '1/2'],
    ['tan()', '45', '1'], ['cot()', '45', '1'],
    ['asin()', String.raw`\frac{1}{2}`, '30'],
    ['acos()', String.raw`\frac{1}{2}`, '60'], ['atan()', '1', '45'],
    ['log()', '100', '2'], ['ln()', '1', '0'],
  ])('creates a usable function argument for %s', (text, selected, expected) => {
    expect(solve(filledTemplate(text, selected, []), { angleMode: 'DEG' }).exact).toBe(expected);
  });

  it('preserves a selected compound expression in a fraction cell', () => {
    expect(solve(filledTemplate('/', '2+3', ['4'])).exact).toBe('5/4');
  });

  it('adds scalar keys without creating an extra placeholder', () => {
    for (const text of ['1', '.', '+', '-', '*', '%', 'pi', 'e', '!', '(', ')']) {
      const result = editorInsertion({ text });
      expect(result.selectionMode).toBe('after');
      expect(result.latex).not.toContain('#');
    }
  });

  it.each(['alert(1)', 'constructor', 'toString', '__proto__', String.raw`\href{url}{x}`, 'unknown()'])('rejects unsupported insertion %s', (text) => {
    expect(() => editorInsertion({ text })).toThrow(MathError);
  });
});

describe('alphabet keyboard templates', () => {
  const letters = Array.from({ length: 26 }, (_, index) => String.fromCharCode(97 + index));

  it.each(letters)('inserts %s as a usable variable without placeholder cells', letter => {
    const insertion = editorInsertion({ text: `var(${letter})` });
    expect(insertion.selectionMode).toBe('after');
    expect(insertion.latex).not.toContain('#');
    const expression = latexToExpression(insertion.latex);
    expect(parse(expression)).toMatchObject({ type: 'variable', name: letter });
    expect(solve(expression).unresolvedVariables).toEqual([letter]);
    expect(solve(expression, { variables: { [letter]: '1/2' } }).exact).toBe('1/2');
  });

  it('keeps the alphabet e distinct from the scientific Euler key', () => {
    const variable = editorInsertion({ text: 'var(e)' });
    const constant = editorInsertion({ text: 'e' });
    expect(variable.latex).not.toBe(constant.latex);
    expect(parse(latexToExpression(variable.latex))).toMatchObject({ type: 'variable', name: 'e' });
    expect(parse(latexToExpression(constant.latex))).toMatchObject({ type: 'constant', name: 'e' });
    expect(solve(latexToExpression(constant.latex), { variables: { e: '7' } }).exact).toBe('e');
  });

  it.each(['var()', 'var(aa)', 'var(A)', 'var(1)', 'var(pi)', 'var(x,y)', 'var(x)+1', 'var(__proto__)'])('rejects invalid alphabet insertion %s', text => {
    expect(() => editorInsertion({ text })).toThrow(MathError);
  });
});
