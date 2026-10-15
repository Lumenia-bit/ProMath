import type { ASTNode } from './ast';
import type { EvaluationEvent, EvaluationTrace } from './evaluator';
import { MathError } from './errors';
import { formatAST } from './format';
import { LIMITS } from './limits';
import { Rational } from './rational';
import { functionRegistry } from './registry';
import type { MathValue } from './types';
import { binaryNode, isRational, numberNode, numeric, valueToAST } from './value';
import { collectVariables } from './variables';

interface Term { coefficient: Rational; powers: Map<string, number> }
type Polynomial = Map<string, Term>;
const TERM_LIMIT = 64;
const arities: Readonly<Record<string, readonly [number, number]>> = {
  sqrt: [1, 1], cbrt: [1, 1], root: [2, 2], square: [1, 1], sin: [1, 1], cos: [1, 1], tan: [1, 1], cot: [1, 1],
  asin: [1, 1], acos: [1, 1], atan: [1, 1], log: [1, 2], ln: [1, 1], abs: [1, 1], factorial: [1, 1],
  ncr: [2, 2], npr: [2, 2], gcd: [2, 20], lcm: [2, 20], mod: [2, 2], frac: [2, 2], mixed: [3, 3],
};
const keyOf = (powers: Map<string, number>) => [...powers].sort(([a], [b]) => a.localeCompare(b)).map(([name, power]) => `${name}:${power}`).join(';');
function addTerm(polynomial: Polynomial, term: Term): boolean {
  const key = keyOf(term.powers);
  const coefficient = (polynomial.get(key)?.coefficient ?? new Rational(0n)).add(term.coefficient);
  if (coefficient.numerator === 0n) polynomial.delete(key);
  else polynomial.set(key, { coefficient, powers: term.powers });
  return polynomial.size <= TERM_LIMIT;
}
const constantPolynomial = (value: Rational): Polynomial => value.numerator === 0n ? new Map() : new Map([['', { coefficient: value, powers: new Map() }]]);
function multiplyPolynomials(left: Polynomial, right: Polynomial): Polynomial | undefined {
  if (left.size * right.size > 4096) return undefined;
  const result: Polynomial = new Map();
  for (const a of left.values()) for (const b of right.values()) {
    const powers = new Map(a.powers);
    for (const [name, power] of b.powers) {
      const exponent = (powers.get(name) ?? 0) + power;
      if (exponent > LIMITS.exponent) return undefined;
      powers.set(name, exponent);
    }
    if (!addTerm(result, { coefficient: a.coefficient.multiply(b.coefficient), powers })) return undefined;
  }
  return result;
}
function polynomialOf(node: ASTNode): Polynomial | undefined {
  if (node.type === 'number') return constantPolynomial(Rational.fromString(node.value));
  if (node.type === 'variable') return new Map([[`${node.name}:1`, { coefficient: new Rational(1n), powers: new Map([[node.name, 1]]) }]]);
  if (node.type === 'function' && node.name === 'frac') return polynomialOf(binaryNode('/', node.args[0], node.args[1]));
  if (node.type === 'function' && node.name === 'square') return polynomialOf(binaryNode('^', node.args[0], numberNode(2)));
  if (node.type === 'percentage') return polynomialOf(binaryNode('/', node.argument, numberNode(100)));
  if (node.type === 'unary') {
    const polynomial = polynomialOf(node.argument);
    if (node.operator === '-' && polynomial) for (const term of polynomial.values()) term.coefficient = term.coefficient.negate();
    return polynomial;
  }
  if (node.type !== 'binary') return undefined;
  if ((node.operator === '+' || node.operator === '-') && node.right.type === 'percentage') return undefined;
  const left = polynomialOf(node.left);
  if (!left) return undefined;
  if (node.operator === '^') {
    if (node.right.type !== 'number') return undefined;
    const exponent = Rational.fromString(node.right.value);
    // Keep x^0 intact: its domain excludes x = 0 in this engine.
    if (!exponent.isInteger || exponent.numerator < 1n || exponent.numerator > BigInt(LIMITS.exponent)) return undefined;
    let remaining = exponent.numerator;
    let factor = left;
    let result = constantPolynomial(new Rational(1n));
    while (remaining > 0n) {
      if (remaining % 2n === 1n) { const product = multiplyPolynomials(result, factor); if (!product) return undefined; result = product; }
      remaining /= 2n;
      if (remaining > 0n) { const squared = multiplyPolynomials(factor, factor); if (!squared) return undefined; factor = squared; }
    }
    return result;
  }
  const right = polynomialOf(node.right);
  if (!right) return undefined;
  if (node.operator === '*') return multiplyPolynomials(left, right);
  if (node.operator === '+' || node.operator === '-') {
    const result = new Map(left);
    for (const term of right.values()) if (!addTerm(result, { ...term, coefficient: node.operator === '-' ? term.coefficient.negate() : term.coefficient })) return undefined;
    return result;
  }
  if (node.operator === '/') {
    const denominator = right.size === 1 ? right.get('')?.coefficient : undefined;
    if (!denominator || denominator.numerator === 0n) return undefined;
    return new Map([...left].map(([key, term]) => [key, { ...term, coefficient: term.coefficient.divide(denominator) }]));
  }
  return undefined;
}
function polynomialAST(polynomial: Polynomial): ASTNode {
  let result: ASTNode | undefined;
  for (const { coefficient, powers } of polynomial.values()) {
    let monomial: ASTNode | undefined;
    for (const [name, exponent] of [...powers].sort(([a], [b]) => a.localeCompare(b))) {
      const variable: ASTNode = { type: 'variable', name, start: 0, end: 0 };
      const factor = exponent === 1 ? variable : binaryNode('^', variable, numberNode(exponent));
      monomial = monomial ? binaryNode('*', monomial, factor) : factor;
    }
    const negative = coefficient.numerator < 0n;
    const magnitude = negative ? coefficient.negate() : coefficient;
    let term = monomial ? magnitude.numerator === 1n ? monomial : binaryNode('*', numberNode(magnitude.numerator), monomial) : numberNode(magnitude.numerator);
    if (magnitude.denominator !== 1n) term = binaryNode('/', term, numberNode(magnitude.denominator));
    result = result ? binaryNode(negative ? '-' : '+', result, term) : negative ? { type: 'unary', operator: '-', argument: term, start: 0, end: 0 } : term;
  }
  return result ?? numberNode(0);
}

export interface AlgebraResult { ast: ASTNode; events: EvaluationEvent[]; conditions: string[] }
export function simplifyAlgebra(ast: ASTNode, evaluateClosed: (ast: ASTNode) => EvaluationTrace): AlgebraResult {
  const events: EvaluationEvent[] = [];
  const conditions = new Set<string>();
  const values = new WeakMap<ASTNode, MathValue>();
  const known = (node: ASTNode): MathValue | undefined => {
    if (collectVariables(node).length) return undefined;
    const cached = values.get(node);
    if (cached) return cached;
    const value = evaluateClosed(node).value;
    values.set(node, value);
    return value;
  };
  const require = (condition: boolean, message: string) => { if (!condition) throw new MathError(message); };
  const nonzero = (node: ASTNode) => {
    const value = known(node);
    if (value) require(isRational(value) ? value.numerator !== 0n : numeric(value) !== 0, 'Нельзя делить на ноль.');
    else conditions.add(`${formatAST(node)} ≠ 0`);
  };
  const positive = (node: ASTNode, message: string) => {
    const value = known(node);
    if (value) require(isRational(value) ? value.numerator > 0n : numeric(value) > 0, message);
    else conditions.add(`${formatAST(node)} > 0`);
  };
  const integerArgument = (node: ASTNode, message: string, nonnegative = false, maximum?: number) => {
    const value = known(node);
    if (value) {
      require(isRational(value) && value.isInteger, message);
      if (isRational(value)) {
        if (nonnegative) require(value.numerator >= 0n, message);
        if (maximum !== undefined) require(value.numerator <= BigInt(maximum), message);
      }
    } else conditions.add(`${formatAST(node)} — ${nonnegative ? 'неотрицательное ' : ''}целое число${maximum === undefined ? '' : `, не больше ${maximum}`}`);
  };
  const factorialDomain = (node: ASTNode) => integerArgument(node, `Факториал определён только для неотрицательных целых чисел не больше ${LIMITS.factorial}.`, true, LIMITS.factorial);
  const functionDomains: Record<string, (args: ASTNode[]) => void> = {
    sqrt: args => { const value = known(args[0]); if (value) require(numeric(value) >= 0, 'Квадратный корень отрицательного числа не определён в действительных числах.'); else conditions.add(`${formatAST(args[0])} ≥ 0`); },
    ln: args => positive(args[0], 'Аргумент логарифма должен быть положительным.'),
    log: args => {
      positive(args[0], 'Аргумент логарифма должен быть положительным.');
      if (args[1]) { positive(args[1], 'Основание логарифма должно быть положительным и не равным 1.'); const value = known(args[1]); if (value) require(isRational(value) ? !value.equals(new Rational(1n)) : numeric(value) !== 1, 'Основание логарифма должно быть положительным и не равным 1.'); else conditions.add(`${formatAST(args[1])} ≠ 1`); }
    },
    root: args => {
      integerArgument(args[1], `Степень корня должна быть ненулевым целым числом от −${LIMITS.exponent} до ${LIMITS.exponent}.`);
      const degree = known(args[1]);
      if (degree && isRational(degree)) {
        require(degree.numerator !== 0n && degree.numerator >= -BigInt(LIMITS.exponent) && degree.numerator <= BigInt(LIMITS.exponent), `Степень корня ограничена по модулю числом ${LIMITS.exponent} и не может быть нулём.`);
        if (degree.numerator % 2n === 0n) functionDomains.sqrt([args[0]]);
        if (degree.numerator < 0n) nonzero(args[0]);
      } else conditions.add(`0 < |${formatAST(args[1])}| ≤ ${LIMITS.exponent}; при чётной степени ${formatAST(args[0])} ≥ 0, при отрицательной степени ${formatAST(args[0])} ≠ 0`);
    },
    factorial: args => factorialDomain(args[0]),
    gcd: args => args.forEach(arg => integerArgument(arg, 'Аргумент НОД должно быть целым числом.')),
    lcm: args => args.forEach(arg => integerArgument(arg, 'Аргумент НОК должно быть целым числом.')),
    frac: args => nonzero(args[1]), mod: args => nonzero(args[1]),
    mixed: args => { integerArgument(args[0], 'Целая часть должна быть целым числом.'); integerArgument(args[1], 'Числитель должен быть неотрицательным целым числом.', true); integerArgument(args[2], 'Знаменатель должен быть положительным целым числом.'); positive(args[2], 'Знаменатель должен быть положительным целым числом.'); },
  };
  for (const name of ['asin', 'acos']) functionDomains[name] = args => { const value = known(args[0]); if (value) require(Math.abs(numeric(value)) <= 1, `${name}: аргумент должен быть от −1 до 1.`); else conditions.add(`−1 ≤ ${formatAST(args[0])} ≤ 1`); };
  for (const name of ['tan', 'cot']) functionDomains[name] = args => { if (!known(args[0])) conditions.add(`${name === 'tan' ? 'cos' : 'sin'}(${formatAST(args[0])}) ≠ 0 в выбранном режиме углов`); };
  for (const name of ['ncr', 'npr']) functionDomains[name] = args => {
    args.forEach(arg => integerArgument(arg, 'Аргументы комбинаторики должны быть неотрицательными целыми числами.', true, LIMITS.factorial));
    const n = known(args[0]); const r = known(args[1]);
    if (n && r) require(numeric(r) <= numeric(n), 'Число выбранных элементов не должно превышать общее число.');
    else conditions.add(`${formatAST(args[1])} ≤ ${formatAST(args[0])}`);
  };
  let count = 0;
  const visitUnchecked = (node: ASTNode, depth: number): ASTNode => {
    if (++count > LIMITS.nodes || depth > LIMITS.depth) throw new MathError('Выражение слишком сложное. Уменьшите вложенность или число операций.');
    if (node.type === 'function') {
      const arity = arities[node.name];
      if (!functionRegistry[node.name] || !arity) throw new MathError(`Неизвестная функция «${node.name}».`);
      require(node.args.length >= arity[0] && node.args.length <= arity[1], arity[0] === arity[1] ? `Функция ожидает ${arity[0]} аргумент(а).` : `Функция ожидает от ${arity[0]} до ${arity[1]} аргументов.`);
    }
    if (!collectVariables(node).length) {
      const trace = evaluateClosed(node);
      events.push(...trace.events);
      const result = valueToAST(trace.value);
      values.set(result, trace.value);
      return result;
    }
    let result = node;
    if (node.type === 'binary') {
      const left = visit(node.left, depth + 1);
      const relativePercentage = (node.operator === '+' || node.operator === '-') && node.right.type === 'percentage';
      // A percentage on the right of +/− is relative to the left operand.
      // Keep that node intact until both operands can be evaluated together.
      const right = relativePercentage && node.right.type === 'percentage' ? { ...node.right, argument: visit(node.right.argument, depth + 2) } : visit(node.right, depth + 1);
      result = { ...node, left, right };
      if (node.operator === '/' || node.operator === '%') nonzero(right);
      if (node.operator === '^') {
        const exponent = known(right);
        if (exponent) {
          require(Math.abs(numeric(exponent)) <= LIMITS.exponent, `Показатель степени ограничен по модулю числом ${LIMITS.exponent}.`);
          if (isRational(exponent) && exponent.numerator <= 0n) nonzero(left);
          if (!isRational(exponent) || !exponent.isInteger) conditions.add(`Степень ${formatAST(result)} должна быть определена в действительных числах`);
        } else conditions.add(`|${formatAST(right)}| ≤ ${LIMITS.exponent}; степень должна быть определена в действительных числах`);
      }
    } else if (node.type === 'function') { const args = node.args.map(arg => visit(arg, depth + 1)); result = { ...node, args }; functionDomains[node.name]?.(args); }
    else if (node.type === 'unary' || node.type === 'factorial' || node.type === 'percentage') { const argument = visit(node.argument, depth + 1); result = { ...node, argument }; if (node.type === 'factorial') factorialDomain(argument); }
    const relativePercentage = result.type === 'binary' && (result.operator === '+' || result.operator === '-') && result.right.type === 'percentage';
    const polynomial = relativePercentage ? undefined : polynomialOf(result);
    const simplified = polynomial ? polynomialAST(polynomial) : result;
    // Cancellation can reveal a closed branch that was not numeric before,
    // such as cot(x − x). Check it through the regular domain algorithms.
    return collectVariables(simplified).length ? simplified : valueToAST(evaluateClosed(simplified).value);
  };
  const visit = (node: ASTNode, depth: number): ASTNode => {
    try { return visitUnchecked(node, depth); }
    catch (error) {
      if (error instanceof MathError && error.position === 0 && error.length === 1) throw new MathError(error.message, node.start, Math.max(1, node.end - node.start));
      throw error;
    }
  };
  return { ast: visit(ast, 0), events, conditions: [...conditions] };
}
