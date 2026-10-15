import { MathError } from '../errors';
import { LIMITS } from '../limits';
import { Rational } from '../rational';
import { binaryNode, expectArity, functionNode, integer, isRational, numberNode, numeric, symbolic, valueToAST, type Operation } from '../value';
import type { MathValue } from '../types';

export function integerNthRoot(value: bigint, degree: number): bigint {
  if (value < 2n || degree === 1) return value;
  const bits = value.toString(2).length;
  if (degree >= bits) return 1n;
  let current = 1n << BigInt(Math.ceil(bits / degree));
  const n = BigInt(degree);
  // Newton's integer iteration decreases to the floor of the real root.
  for (;;) {
    const next = ((n - 1n) * current + value / current ** (n - 1n)) / n;
    if (next >= current) return current;
    current = next;
  }
}
function extractSquare(value: bigint): [bigint, bigint] {
  const root = integerNthRoot(value, 2);
  if (root * root === value) return [root, 1n];
  let outside = 1n;
  let inside = value;
  // Bounded trial division improves common radicals without unbounded factoring.
  for (let divisor = 2n; divisor <= 10000n && divisor * divisor <= inside; divisor += divisor === 2n ? 1n : 2n) {
    const square = divisor * divisor;
    while (inside % square === 0n) { outside *= divisor; inside /= square; }
  }
  return [outside, inside];
}
function approximateRoot(value: MathValue, degree: number): number {
  if (!isRational(value)) return Math.sign(value.approximation) * Math.abs(value.approximation) ** (1 / degree);
  const n = value.numerator < 0n ? -value.numerator : value.numerator;
  const digitsN = n.toString();
  const digitsD = value.denominator.toString();
  const logN = Math.log(Number(digitsN.slice(0, 16))) + (digitsN.length - Math.min(digitsN.length, 16)) * Math.LN10;
  const logD = Math.log(Number(digitsD.slice(0, 16))) + (digitsD.length - Math.min(digitsD.length, 16)) * Math.LN10;
  return (value.numerator < 0n ? -1 : 1) * Math.exp((logN - logD) / degree);
}
export function rootValue(value: MathValue, degree: number): MathValue {
  if (!Number.isInteger(degree) || degree === 0 || Math.abs(degree) > LIMITS.exponent) throw new MathError(`Степень корня должна быть ненулевым целым числом от −${LIMITS.exponent} до ${LIMITS.exponent}.`);
  const absoluteDegree = Math.abs(degree);
  const negative = isRational(value) ? value.numerator < 0n : numeric(value) < 0;
  if (negative && absoluteDegree % 2 === 0) throw new MathError('Чётный корень отрицательного числа не определён в действительных числах.');
  if (degree < 0 && (isRational(value) ? value.numerator === 0n : numeric(value) === 0)) throw new MathError('Корень отрицательной степени из нуля не определён.');
  if (degree === 1) return value;
  if (isRational(value)) {
    const magnitude = negative ? -value.numerator : value.numerator;
    const n = integerNthRoot(magnitude, absoluteDegree);
    const d = integerNthRoot(value.denominator, absoluteDegree);
    if (n ** BigInt(absoluteDegree) === magnitude && d ** BigInt(absoluteDegree) === value.denominator) {
      const exact = new Rational(negative ? -n : n, d);
      return degree < 0 ? new Rational(1n).divide(exact) : exact;
    }
    if (degree === 2) {
      const [numeratorOutside, numeratorInside] = extractSquare(magnitude);
      const [denominatorOutside, denominatorInside] = extractSquare(value.denominator);
      const inside = new Rational(numeratorInside).multiply(new Rational(denominatorInside)).numerator;
      const denominator = new Rational(denominatorOutside).multiply(new Rational(denominatorInside)).numerator;
      const coefficient = new Rational(numeratorOutside, denominator);
      const radical = functionNode('sqrt', [numberNode(inside)]);
      const expression = coefficient.equals(new Rational(1n)) ? radical : binaryNode('*', valueToAST(coefficient), radical);
      return symbolic(expression, approximateRoot(value, degree));
    }
  }
  const name = degree === 2 ? 'sqrt' : degree === 3 ? 'cbrt' : 'root';
  const args = degree === 2 || degree === 3 ? [valueToAST(value)] : [valueToAST(value), numberNode(degree)];
  return symbolic(functionNode(name, args), approximateRoot(value, degree));
}
export const squareRoot: Operation = (args) => { expectArity(args, 1); return rootValue(args[0], 2); };
export const cubeRoot: Operation = (args) => { expectArity(args, 1); return rootValue(args[0], 3); };
export const nthRoot: Operation = (args) => {
  expectArity(args, 2);
  const degree = integer(args[1], 'Степень корня');
  if (degree < -BigInt(LIMITS.exponent) || degree > BigInt(LIMITS.exponent)) throw new MathError(`Степень корня ограничена по модулю числом ${LIMITS.exponent}.`);
  return rootValue(args[0], Number(degree));
};
