import { MathError } from '../errors';
import { LIMITS } from '../limits';
import { Rational } from '../rational';
import { constantNode, expectArity, functionNode, isOne, isRational, numeric, sameExpression, symbolic, valueToAST, type Operation } from '../value';
import type { MathValue } from '../types';

function logarithmNumber(value: MathValue): number {
  if (!isRational(value)) return Math.log(value.approximation);
  const delta = new Rational(value.numerator - value.denominator, value.denominator).toNumber();
  if (Math.abs(delta) <= 0.25) return Math.log1p(delta);
  const n = value.numerator.toString();
  const d = value.denominator.toString();
  return Math.log(Number(n.slice(0, 16))) - Math.log(Number(d.slice(0, 16))) + (Math.max(0, n.length - 16) - Math.max(0, d.length - 16)) * Math.LN10;
}
function logarithmValue(value: MathValue, base: MathValue, name: 'log' | 'ln', explicitBase: boolean): MathValue {
  if (isRational(value) ? value.numerator <= 0n : numeric(value) <= 0) throw new MathError('Аргумент логарифма должен быть положительным.');
  if ((isRational(base) ? base.numerator <= 0n : numeric(base) <= 0) || isOne(base) || (!isRational(base) && numeric(base) === 1)) throw new MathError('Основание логарифма должно быть положительным и не равным 1.');
  if (isOne(value)) return new Rational(0n);
  if (sameExpression(valueToAST(value), valueToAST(base))) return new Rational(1n);
  const expression = valueToAST(value);
  if (expression.type === 'binary' && expression.operator === '^' && sameExpression(expression.left, valueToAST(base))) {
    if (expression.right.type === 'number') return Rational.fromString(expression.right.value);
  }
  const approximate = logarithmNumber(value) / logarithmNumber(base);
  if (isRational(value) && isRational(base)) {
    // Verify candidate rational logarithms by exact integer powers, never rounding the answer into an exact value.
    for (let denominator = 1; denominator <= 16; denominator += 1) {
      const numerator = Math.round(approximate * denominator);
      if (Math.abs(numerator) > LIMITS.exponent || Math.abs(approximate - numerator / denominator) > 1e-11) continue;
      try { if (value.pow(denominator).equals(base.pow(numerator))) return new Rational(BigInt(numerator), BigInt(denominator)); } catch (error) { if (!(error instanceof MathError)) throw error; }
    }
  }
  const args = name === 'ln' || !explicitBase ? [valueToAST(value)] : [valueToAST(value), valueToAST(base)];
  return symbolic(functionNode(name, args), approximate);
}
export const logarithm: Operation = (args) => {
  expectArity(args, 1, 2);
  return logarithmValue(args[0], args[1] ?? new Rational(10n), 'log', args.length === 2);
};
export const naturalLogarithm: Operation = (args) => {
  expectArity(args, 1);
  return logarithmValue(args[0], symbolic(constantNode('e'), Math.E), 'ln', false);
};
