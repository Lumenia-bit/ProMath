import { describe, expect, it } from 'vitest';
import { collectVariables, MathError, parse, solve, tokenize } from '../src/math';
import { LIMITS } from '../src/math/limits';
import type { ASTNode } from '../src/math/ast';

const letters = Array.from({ length: 26 }, (_, index) => String.fromCharCode(97 + index));
const compact = (expression: string) => expression.replace(/\s+/g, '');
const inputFor = (letter: string) => letter === 'e' ? 'var(e)' : letter;

function variableNodes(ast: ASTNode): ASTNode[] {
  if (ast.type === 'variable') return [ast];
  if (ast.type === 'binary') return [...variableNodes(ast.left), ...variableNodes(ast.right)];
  if (ast.type === 'function') return ast.args.flatMap(variableNodes);
  if (ast.type === 'unary' || ast.type === 'factorial' || ast.type === 'percentage') return variableNodes(ast.argument);
  return [];
}

describe('variable syntax and AST', () => {
  it.each(letters)('accepts %s as a typed variable', (letter) => {
    expect(parse(inputFor(letter))).toMatchObject({ type: 'variable', name: letter });
    const solution = solve(inputFor(letter));
    expect(solution.unresolvedVariables).toEqual([letter]);
    expect(solution.approximate).toBe('');
  });

  it('uses separate variable nodes for implicit multiplication', () => {
    expect(parse('xy')).toMatchObject({ type: 'binary', operator: '*', left: { type: 'variable', name: 'x' }, right: { type: 'variable', name: 'y' } });
    expect(variableNodes(parse('xyz')).map(node => node.type === 'variable' ? node.name : '')).toEqual(['x', 'y', 'z']);
    expect(variableNodes(parse('abc')).map(node => node.type === 'variable' ? node.name : '')).toEqual(['a', 'b', 'c']);
    expect(parse('2x')).toMatchObject({ type: 'binary', operator: '*', left: { type: 'number', value: '2' }, right: { type: 'variable', name: 'x' } });
    expect(parse('x(y+1)')).toMatchObject({ type: 'binary', operator: '*', left: { type: 'variable', name: 'x' }, right: { type: 'binary', operator: '+' } });
  });

  it('preserves source positions of variables', () => {
    const input = ' 2x + sqrt(y)';
    const nodes = variableNodes(parse(input));
    expect(nodes).toMatchObject([{ type: 'variable', name: 'x', start: 2, end: 3 }, { type: 'variable', name: 'y', start: 11, end: 12 }]);
    expect(tokenize(input).filter(token => token.value === 'x' || token.value === 'y').map(token => input.slice(token.start, token.end))).toEqual(['x', 'y']);
  });

  it('keeps the Euler constant distinct from an unknown e', () => {
    expect(parse('e')).toMatchObject({ type: 'constant', name: 'e' });
    expect(parse('var(e)')).toMatchObject({ type: 'variable', name: 'e' });
    expect(solve('ln(e)').exact).toBe('1');
    expect(solve('e', { variables: { e: '2' } }).exact).toBe('e');
    expect(solve('var(e)', { variables: { e: '2' } }).exact).toBe('2');
    expect(solve('1.2e-5').exact).toBe('3/250000');
  });

  it('collects variables through every AST child type, sorted and deduplicated', () => {
    expect(collectVariables(parse('sqrt(z)+b+a+a+var(e)+x!+y%+-c'))).toEqual(['a', 'b', 'c', 'e', 'x', 'y', 'z']);
  });

  it.each(['alert(1)', 'constructor(1)', 'window.location', 'unknown(2)', 'var(pi)', 'var(1)', 'var(x,y)', 'α+1'])('rejects unsupported names and malformed variable references: %s', (input) => {
    expect(() => solve(input)).toThrow(MathError);
  });
});

describe('symbolic variables', () => {
  it.each([
    ['2x+3x', '5*x'], ['x-x', '0'], ['x*x', 'x^2'],
    ['2xy+3yx', '5*x*y'], ['(x+1)-(x+1)', '0'],
  ])('simplifies %s exactly', (input, exact) => {
    expect(compact(solve(input).exact)).toBe(compact(exact));
  });

  it('combines fractional coefficients without decimal conversion', () => {
    expect(['5/6*x', '5*x/6']).toContain(compact(solve('x/2+x/3').exact));
  });

  it('preserves the mathematics of a product with parentheses', () => {
    const result = solve('2(x+1)');
    for (const x of ['-2', '0', '1/2', '3']) {
      expect(solve(result.exact, { variables: { x } }).exact).toBe(solve('2(x+1)', { variables: { x } }).exact);
    }
  });

  it('retains distinct terms and reports unknown letters in sorted order', () => {
    const result = solve('b+a+c+b');
    expect(result.unresolvedVariables).toEqual(['a', 'b', 'c']);
    expect(result.exact).toContain('a');
    expect(result.exact).toContain('b');
    expect(result.exact).toContain('c');
    expect(result.approximate).toBe('');
    expect(result.approximateLatex).toBe('');
  });

  it.each(['sqrt(x)', 'sin(x)', 'x^y', 'log(x,2)', 'abs(x)', 'x!', 'gcd(x,12)'])('preserves %s without fabricating an approximation', (input) => {
    const result = solve(input);
    expect(result.unresolvedVariables?.length).toBeGreaterThan(0);
    expect(result.approximate).toBe('');
    expect(result.exact).not.toMatch(/NaN|undefined|Infinity/);
    expect(result.latex).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('still validates known erroneous subexpressions before simplifying unknown terms', () => {
    for (const input of ['x+1/0', '0*(x+1/0)', 'x+sqrt(-1)', 'x+log(0)', 'sqrt(-1)*x', 'x/0', 'log(x,1)', 'root(x,0)', 'sqrt(x,1)', 'gcd(x,1.5)']) {
      expect(() => solve(input)).toThrow(MathError);
    }
  });

  it.each(['cot(x-x)+a', 'tan(x-x+pi/2)+a', 'asin(x-x+1+1e-1000)+a', 'log(x-x,a)'])('rechecks the domain when cancellation closes a function argument: %s', expression => {
    expect(() => solve(expression, { angleMode: 'RAD' })).toThrow(MathError);
  });

  it.each(['sin(x-x)+a', 'sqrt(x-x+16)+a'])('evaluates function arguments that become numeric after cancellation: %s', expression => {
    const result = solve(expression, { angleMode: 'RAD' });
    expect(result.unresolvedVariables).toEqual(['a']);
    expect(solve(result.exact, { variables: { a: '2' } }).exact).toBe(solve(expression, { variables: { x: '7', a: '2' } }).exact);
  });

  it('retains domain conditions after eliminating variable-containing terms', () => {
    for (const expression of ['0/x', 'x^0', '0*sqrt(x)', '0*ln(x)']) {
      const result = solve(expression);
      expect(result.unresolvedVariables?.length || result.conditions?.length).toBeGreaterThan(0);
    }
  });

  it('does not silently erase the domain restriction of division by x', () => {
    const result = solve('x/x');
    expect(compact(result.exact) !== '1' || (result.conditions?.length ?? 0) > 0).toBe(true);
    expect(() => solve('x/x', { variables: { x: '0' } })).toThrow(MathError);
    expect(solve('x/x', { variables: { x: '2' } }).exact).toBe('1');
  });

  it('creates generated solution steps containing the symbolic calculation', () => {
    const result = solve('2x+3x');
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps.some(step => compact(step.after) === compact(result.exact))).toBe(true);
    expect(result.steps.every(step => step.explanation.length > 0)).toBe(true);
  });

  it.each(['2a+3a', '(a+b)*(a-b)', '(a+b)^2', 'a/2+a/3', '-a*-b', '(a-b)*(b-a)', 'a^2*a^3', '0*a+1'])('keeps symbolic simplification equivalent under bounded substitutions: %s', expression => {
    const simplified = solve(expression).exact;
    for (const variables of [{ a: '-2', b: '3' }, { a: '0', b: '1/3' }, { a: '1/2', b: '-3/4' }]) {
      expect(solve(simplified, { variables }).exact).toBe(solve(expression, { variables }).exact);
    }
  });

  it.each(['500+x%', 'x+20%', 'x-20%', '500+(x+20%)', 'x+(10+10)%', 'x+(10%+20%)', '2(x+20%)'])('preserves contextual percentage semantics with unknowns: %s', expression => {
    const result = solve(expression);
    for (const x of ['-10', '0', '25', '1/2']) {
      const expected = solve(expression, { variables: { x } }).exact;
      expect(solve(result.exact, { variables: { x } }).exact).toBe(expected);
      for (const step of result.steps.filter(item => item.type === 'operation' || item.type === 'simplification')) {
        expect(solve(step.before, { variables: { x } }).exact).toBe(expected);
        expect(solve(step.after, { variables: { x } }).exact).toBe(expected);
      }
    }
  });

  it.each(['(x+20%)+y', '(x+20%)^2', 'square(x+20%)', '(x+20%)*2', '(x-20%)/(y+1)'])('preserves nested relative percentages during polynomial simplification: %s', expression => {
    const result = solve(expression);
    for (const variables of [{ x: '100', y: '1' }, { x: '-10', y: '1/2' }, { x: '0', y: '3' }]) {
      const expected = solve(expression, { variables }).exact;
      expect(solve(result.exact, { variables }).exact).toBe(expected);
      for (const step of result.steps.filter(item => item.type === 'operation' || item.type === 'simplification')) {
        expect(solve(step.before, { variables }).exact).toBe(expected);
        expect(solve(step.after, { variables }).exact).toBe(expected);
      }
    }
  });
});

describe('variable substitution', () => {
  it('can bind all 26 letters independently', () => {
    const expression = letters.map(inputFor).join('+');
    const variables = Object.fromEntries(letters.map((letter, index) => [letter, String(index + 1)]));
    expect(solve(expression, { variables }).exact).toBe('351');
  });
  it.each([
    ['2x+1', { x: '2' }, '5'],
    ['a+b', { a: '1/2', b: '1/3' }, '5/6'],
    ['x+y', { x: '0.1', y: '0.2' }, '3/10'],
    ['2x', { x: '1.2e-5' }, '3/125000'],
    ['x^2+y', { x: '-3', y: '1/2' }, '19/2'],
    ['sqrt(x)', { x: '16' }, '4'],
    ['log(x,2)', { x: '8' }, '3'],
    ['x!', { x: '5' }, '120'],
  ])('substitutes numeric values into %s', (input, variables, exact) => {
    const result = solve(input, { variables });
    expect(result.exact).toBe(exact);
    expect(result.unresolvedVariables ?? []).toEqual([]);
    expect(result.approximate).not.toBe('');
  });

  it('keeps exact irrational substitution results', () => {
    const result = solve('sqrt(x)', { variables: { x: '2' } });
    expect(result.exact).toBe('sqrt(2)');
    expect(result.approximate).toBe('1.4142135624');
  });

  it('accepts closed mathematical expressions for numeric bindings', () => {
    expect(solve('x+1', { variables: { x: 'sqrt(4)' } }).exact).toBe('3');
    expect(solve('sin(x/2)', { variables: { x: 'pi' } }).exact).toBe('1');
  });

  it('evaluates trigonometry using the selected angle mode', () => {
    expect(solve('sin(x)', { angleMode: 'DEG', variables: { x: '30' } }).exact).toBe('1/2');
    expect(Number(solve('sin(x)', { angleMode: 'RAD', variables: { x: '1' } }).approximate)).toBeCloseTo(Math.sin(1), 9);
  });

  it('retains only remaining unknowns after partial substitution', () => {
    const result = solve('2x+y', { variables: { x: '3' } });
    expect(result.unresolvedVariables).toEqual(['y']);
    expect(result.exact).toContain('6');
    expect(result.exact).toContain('y');
    expect(result.approximate).toBe('');
  });

  it.each([
    ['1/x', '0'], ['sqrt(x)', '-1'], ['x!', '-1'], ['x!', '0.5'],
    ['ln(x)', '0'], ['asin(x)', '2'],
  ])('checks the domain of %s after substituting x=%s', (expression, value) => {
    expect(() => solve(expression, { variables: { x: value } })).toThrow(MathError);
  });

  it.each(['abc', '1/0', 'x', 'x+1', 'globalThis.alert(1)', 'constructor.constructor("return 2")()', '1;2'])('rejects invalid or nonnumeric substitution values: %s', (value) => {
    expect(() => solve('x+1', { variables: { x: value } })).toThrow(MathError);
  });

  it('treats an empty value field as an unknown variable', () => {
    const result = solve('x+1', { variables: { x: '  ' } });
    expect(result.unresolvedVariables).toEqual(['x']);
    expect(result.approximate).toBe('');
  });

  it('does not resolve unknown variables through inherited object properties', () => {
    const variables = Object.create({ x: '7' }) as Record<string, string>;
    const result = solve('x+1', { variables });
    expect(result.unresolvedVariables).toEqual(['x']);
    expect(result.approximate).toBe('');
  });

  it('ignores prototype-related binding keys without changing object prototypes', () => {
    const variables = Object.fromEntries([['x', '2'], ['__proto__', '7'], ['constructor', '9'], ['prototype', '11']]);
    const originalPrototype = Object.getPrototypeOf(variables);
    expect(solve('x+1', { variables }).exact).toBe('3');
    expect(Object.getPrototypeOf(variables)).toBe(originalPrototype);
    expect(Object.hasOwn(Object.prototype, 'x')).toBe(false);
  });

  it('rejects cyclic variable bindings rather than recursing indefinitely', () => {
    expect(() => solve('x+y', { variables: { x: 'y', y: 'x' } })).toThrow(MathError);
  });

  it('keeps the original numeric resource limits for values substituted into variables', () => {
    expect(() => solve('x!', { variables: { x: String(LIMITS.factorial + 1) } })).toThrow(MathError);
    expect(() => solve('2^x', { variables: { x: String(LIMITS.exponent + 1) } })).toThrow(MathError);
    expect(() => solve('x+1', { variables: { x: `1e${LIMITS.scientificExponent + 1}` } })).toThrow(MathError);
    expect(() => parse('sqrt('.repeat(LIMITS.depth + 1) + 'x' + ')'.repeat(LIMITS.depth + 1))).toThrow(MathError);
  });

  it('applies the AST depth budget while collecting variables in a manually created tree', () => {
    let ast: ASTNode = { type: 'variable', name: 'x', start: 0, end: 1 };
    for (let depth = 0; depth <= LIMITS.depth; depth++) ast = { type: 'unary', operator: '-', argument: ast, start: 0, end: 1 };
    expect(() => collectVariables(ast)).toThrow(MathError);
  });
});
