import { MathError } from '../errors';
import { LIMITS } from '../limits';
import { Rational } from '../rational';
import { rationalRadical } from '../radical';
import { binaryNode, expectArity, isOne, isRational, isZero, numeric, symbolic, valueToAST, type Operation } from '../value';
import { rootValue } from './root';

export const power: Operation = ([base, exponent]) => {
  if (isZero(base) && (isRational(exponent) ? exponent.numerator <= 0n : numeric(exponent) <= 0)) throw new MathError('Ноль в нулевой или отрицательной степени не определён.');
  const negativeBase = isRational(base) ? base.numerator < 0n : numeric(base) < 0;
  if (negativeBase && isRational(exponent) && exponent.denominator % 2n === 0n) throw new MathError('Эта степень не определена в действительных числах.');
  if (Math.abs(numeric(exponent)) > LIMITS.exponent) throw new MathError(`Показатель степени ограничен по модулю числом ${LIMITS.exponent}.`);
  if (isZero(exponent)) return new Rational(1n);
  if (isZero(base)) return new Rational(0n);
  if (isOne(exponent)) return base;
  if (isOne(base)) return base;
  if (isRational(base) && isRational(exponent)) {
    if (exponent.isInteger) return base.pow(exponent.numerator);
    if (exponent.denominator <= BigInt(LIMITS.exponent) && (exponent.numerator < 0n ? -exponent.numerator : exponent.numerator) <= BigInt(LIMITS.exponent)) {
      const rooted = rootValue(base, Number(exponent.denominator));
      if (isRational(rooted)) return rooted.pow(exponent.numerator);
    }
  }
  const expression = valueToAST(base);
  const radical = rationalRadical(expression);
  if (radical && isRational(exponent) && exponent.isInteger) {
    const n = exponent.numerator;
    const degree = BigInt(radical.degree);
    const coefficient = radical.coefficient.pow(n).multiply(radical.radicand.pow(n / degree));
    if (n % degree === 0n) return coefficient;
    const root = rootValue(radical.radicand.pow(n % degree), radical.degree);
    if (isRational(root)) return coefficient.multiply(root);
    if (coefficient.equals(new Rational(1n))) return root;
    return symbolic(binaryNode('*', valueToAST(coefficient), valueToAST(root)), numeric(coefficient) * numeric(root));
  }
  let approximate: number;
  if (numeric(base) < 0 && isRational(exponent) && exponent.denominator % 2n === 1n) {
    approximate = (exponent.numerator % 2n === 0n ? 1 : -1) * Math.abs(numeric(base)) ** numeric(exponent);
  } else {
    approximate = numeric(base) ** numeric(exponent);
  }
  if (Number.isNaN(approximate)) throw new MathError('Эта степень не определена в действительных числах.');
  // Fractional powers keep their root form when it is a simple radical.
  if (isRational(exponent) && exponent.numerator === 1n && exponent.denominator <= BigInt(LIMITS.exponent)) return rootValue(base, Number(exponent.denominator));
  return symbolic(binaryNode('^', expression, valueToAST(exponent)), approximate);
};
export const square: Operation = (args, node, context) => { expectArity(args, 1); return power([args[0], new Rational(2n)], node, context); };
