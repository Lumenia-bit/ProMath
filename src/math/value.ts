import type { ASTNode } from './ast';
import { MathError } from './errors';
import { Rational } from './rational';
import type { AngleMode, MathValue, SymbolicValue } from './types';

export interface OperationContext { angleMode: AngleMode }
export type Operation = (args: MathValue[], node: ASTNode, context: OperationContext) => MathValue;

export const span = { start: 0, end: 0 };
export const numberNode = (value: string | bigint | number): ASTNode => ({ type: 'number', value: String(value), ...span });
export const binaryNode = (operator: '+' | '-' | '*' | '/' | '%' | '^', left: ASTNode, right: ASTNode): ASTNode => ({ type: 'binary', operator, left, right, ...span });
export const functionNode = (name: string, args: ASTNode[]): ASTNode => ({ type: 'function', name, args, ...span });
export const constantNode = (name: 'pi' | 'e'): ASTNode => ({ type: 'constant', name, ...span });
export const isRational = (value: MathValue): value is Rational => value instanceof Rational;
export const isZero = (value: MathValue) => isRational(value) && value.numerator === 0n;
export const isOne = (value: MathValue) => isRational(value) && value.numerator === value.denominator;
export const numeric = (value: MathValue): number => isRational(value) ? value.toNumber() : value.approximation;
export function valueToAST(value: MathValue): ASTNode {
  if (!isRational(value)) return value.expression;
  return value.denominator === 1n ? numberNode(value.numerator) : binaryNode('/', numberNode(value.numerator), numberNode(value.denominator));
}
export function symbolic(expression: ASTNode, approximation: number): SymbolicValue {
  if (!Number.isFinite(approximation)) throw new MathError('Результат выходит за допустимый числовой диапазон.');
  if (approximation === 0) throw new MathError('Приближённый результат слишком мал или потерял точность. Упростите выражение.');
  return { kind: 'symbolic', expression, approximation };
}
export function integer(value: MathValue, label: string): bigint {
  if (!isRational(value) || !value.isInteger) throw new MathError(`${label} должно быть целым числом.`);
  return value.numerator;
}
export function expectArity(args: MathValue[], min: number, max = min): void {
  if (args.length < min || args.length > max) throw new MathError(min === max ? `Функция ожидает ${min} аргумент(а).` : `Функция ожидает от ${min} до ${max} аргументов.`);
}
export function sameExpression(a: ASTNode, b: ASTNode): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'number' && b.type === 'number') return Rational.fromString(a.value).equals(Rational.fromString(b.value));
  if (a.type === 'constant' && b.type === 'constant') return a.name === b.name;
  if (a.type === 'variable' && b.type === 'variable') return a.name === b.name;
  if (a.type === 'binary' && b.type === 'binary') return a.operator === b.operator && sameExpression(a.left, b.left) && sameExpression(a.right, b.right);
  if (a.type === 'unary' && b.type === 'unary') return a.operator === b.operator && sameExpression(a.argument, b.argument);
  if (a.type === 'function' && b.type === 'function') return a.name === b.name && a.args.length === b.args.length && a.args.every((arg, index) => sameExpression(arg, b.args[index]));
  if ((a.type === 'factorial' || a.type === 'percentage') && (b.type === 'factorial' || b.type === 'percentage')) return sameExpression(a.argument, b.argument);
  return false;
}
export function negate(value: MathValue): MathValue {
  if (isRational(value)) return value.negate();
  if (value.expression.type === 'unary' && value.expression.operator === '-') return symbolic(value.expression.argument, -value.approximation);
  return symbolic({ type: 'unary', operator: '-', argument: value.expression, ...span }, -value.approximation);
}
export function scale(value: MathValue, coefficient: Rational): MathValue {
  if (isRational(value)) return coefficient.multiply(value);
  if (coefficient.numerator === 0n) return new Rational(0n);
  if (coefficient.equals(new Rational(1n))) return value;
  if (coefficient.equals(new Rational(-1n))) return negate(value);
  return symbolic(binaryNode('*', valueToAST(coefficient), value.expression), coefficient.toNumber() * value.approximation);
}
