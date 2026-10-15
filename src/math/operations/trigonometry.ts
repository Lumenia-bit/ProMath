import type { ASTNode } from '../ast';
import { MathError } from '../errors';
import { Rational } from '../rational';
import { rationalRadical } from '../radical';
import type { MathValue } from '../types';
import { binaryNode, constantNode, expectArity, functionNode, isRational, negate, numberNode, numeric, sameExpression, symbolic, valueToAST, type Operation, type OperationContext } from '../value';
import { division } from './division';
import { rootValue } from './root';

function rationalAST(node: ASTNode): Rational | undefined {
  if (node.type === 'number') return Rational.fromString(node.value);
  if (node.type === 'unary') { const value = rationalAST(node.argument); return node.operator === '-' ? value?.negate() : value; }
  if (node.type !== 'binary') return undefined;
  const left = rationalAST(node.left);
  const right = rationalAST(node.right);
  if (!left || !right) return undefined;
  const operations = { '+': () => left.add(right), '-': () => left.subtract(right), '*': () => left.multiply(right), '/': () => left.divide(right), '%': () => left.modulo(right), '^': () => right.isInteger ? left.pow(right.numerator) : undefined };
  return operations[node.operator]();
}
function piCoefficient(node: ASTNode): Rational | undefined {
  if (node.type === 'constant' && node.name === 'pi') return new Rational(1n);
  if (node.type === 'number' && Rational.fromString(node.value).numerator === 0n) return new Rational(0n);
  if (node.type === 'unary') { const coefficient = piCoefficient(node.argument); return node.operator === '-' ? coefficient?.negate() : coefficient; }
  if (node.type !== 'binary') return undefined;
  if (node.operator === '+' || node.operator === '-') {
    const left = piCoefficient(node.left);
    const right = piCoefficient(node.right);
    if (left && right) return node.operator === '+' ? left.add(right) : left.subtract(right);
  }
  if (node.operator === '*') {
    const left = rationalAST(node.left);
    const rightCoefficient = piCoefficient(node.right);
    if (left && rightCoefficient) return left.multiply(rightCoefficient);
    const right = rationalAST(node.right);
    const leftCoefficient = piCoefficient(node.left);
    if (right && leftCoefficient) return right.multiply(leftCoefficient);
  }
  if (node.operator === '/') {
    const left = piCoefficient(node.left);
    const right = rationalAST(node.right);
    if (left && right) return left.divide(right);
  }
  return undefined;
}
function exactDegrees(value: MathValue, context: OperationContext): Rational | undefined {
  if (context.angleMode === 'DEG') return isRational(value) ? value : undefined;
  if (isRational(value) && value.numerator === 0n) return new Rational(0n);
  return piCoefficient(valueToAST(value))?.multiply(new Rational(180n));
}
function exactSine(degrees: Rational, node: ASTNode, context: OperationContext): MathValue | undefined {
  let normalized = degrees.modulo(new Rational(360n));
  if (normalized.numerator < 0n) normalized = normalized.add(new Rational(360n));
  let angle = normalized.toNumber();
  let sign = 1;
  if (angle > 180) { sign = -1; angle -= 180; normalized = normalized.subtract(new Rational(180n)); }
  if (angle > 90) normalized = new Rational(180n).subtract(normalized);
  let result: MathValue | undefined;
  const exact = normalized.toString();
  if (exact === '0') result = new Rational(0n);
  if (exact === '30') result = new Rational(1n, 2n);
  if (exact === '45' || exact === '60') result = division([rootValue(new Rational(exact === '45' ? 2n : 3n), 2), new Rational(2n)], node, context);
  if (exact === '90') result = new Rational(1n);
  return result && sign < 0 ? negate(result) : result;
}
function trig(name: 'sin' | 'cos' | 'tan' | 'cot'): Operation {
  return (args, node, context) => {
    expectArity(args, 1);
    const value = args[0];
    const degrees = exactDegrees(value, context);
    if (degrees) {
      const sine = exactSine(degrees, node, context);
      const cosine = exactSine(degrees.add(new Rational(90n)), node, context);
      if (name === 'sin' && sine) return sine;
      if (name === 'cos' && cosine) return cosine;
      if ((name === 'tan' || name === 'cot') && sine && cosine) {
        const numerator = name === 'tan' ? sine : cosine;
        const denominator = name === 'tan' ? cosine : sine;
        if (numeric(denominator) === 0) throw new MathError(`${name} не определён для этого угла.`);
        return division([numerator, denominator], node, context);
      }
    }
    const radians = context.angleMode === 'DEG' ? numeric(value) * Math.PI / 180 : numeric(value);
    if (!Number.isFinite(radians)) throw new MathError('Угол слишком большой для надёжного приближённого вычисления.');
    const sine = Math.sin(radians);
    const cosine = Math.cos(radians);
    if ((name === 'tan' && cosine === 0) || (name === 'cot' && sine === 0)) throw new MathError(`${name} не определён для этого угла.`);
    const functions = { sin: () => sine, cos: () => cosine, tan: () => sine / cosine, cot: () => cosine / sine };
    return symbolic(functionNode(name, [valueToAST(value)]), functions[name]());
  };
}
function angleValue(degrees: Rational, context: OperationContext): MathValue {
  if (context.angleMode === 'DEG' || degrees.numerator === 0n) return degrees;
  const coefficient = degrees.divide(new Rational(180n));
  if (coefficient.equals(new Rational(1n))) return symbolic(constantNode('pi'), Math.PI);
  const expression = coefficient.numerator === 1n ? binaryNode('/', constantNode('pi'), numberNode(coefficient.denominator)) : binaryNode('*', valueToAST(coefficient), constantNode('pi'));
  return symbolic(expression, coefficient.toNumber() * Math.PI);
}
function inverse(name: 'asin' | 'acos' | 'atan'): Operation {
  return (args, node, context) => {
    expectArity(args, 1);
    const value = args[0];
    const approximate = numeric(value);
    if ((name === 'asin' || name === 'acos') && (isRational(value) ? value.numerator < -value.denominator || value.numerator > value.denominator : Math.abs(approximate) > 1)) throw new MathError(`${name}: аргумент должен быть от −1 до 1.`);
    const sineCandidates = [0, 30, 45, 60, 90];
    const atanCandidates = [0, 30, 45, 60];
    for (const degrees of name === 'atan' ? atanCandidates : sineCandidates) {
      const candidate = name === 'atan' ? trig('tan')([new Rational(BigInt(degrees))], node, { angleMode: 'DEG' }) : exactSine(new Rational(BigInt(degrees)), node, context)!;
      const absolute = approximate < 0 ? negate(value) : value;
      const a = rationalRadical(valueToAST(absolute));
      const b = rationalRadical(valueToAST(candidate));
      const equalRadicals = a && b && a.degree === b.degree && a.coefficient.equals(b.coefficient) && a.radicand.equals(b.radicand);
      if (!sameExpression(valueToAST(absolute), valueToAST(candidate)) && !equalRadicals) continue;
      const signed = approximate < 0 ? -degrees : degrees;
      return angleValue(new Rational(BigInt(name === 'acos' ? 90 - signed : signed)), context);
    }
    const functions = { asin: Math.asin, acos: Math.acos, atan: Math.atan };
    const radians = functions[name](approximate);
    return symbolic(functionNode(name, [valueToAST(value)]), context.angleMode === 'DEG' ? radians * 180 / Math.PI : radians);
  };
}
export const sine = trig('sin');
export const cosine = trig('cos');
export const tangent = trig('tan');
export const cotangent = trig('cot');
export const arcsine = inverse('asin');
export const arccosine = inverse('acos');
export const arctangent = inverse('atan');
