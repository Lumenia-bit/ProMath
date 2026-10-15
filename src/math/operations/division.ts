import { MathError } from '../errors';
import { Rational } from '../rational';
import { rationalRadical } from '../radical';
import { binaryNode, isOne, isRational, isZero, numeric, sameExpression, scale, symbolic, valueToAST, type Operation } from '../value';
import { rootValue } from './root';

export const division: Operation = ([left, right]) => {
  if (isZero(right) || (!isRational(right) && numeric(right) === 0)) throw new MathError('Нельзя делить на ноль.');
  if (isRational(left) && isRational(right)) return left.divide(right);
  if (isZero(left)) return new Rational(0n);
  if (isOne(right)) return left;
  if (sameExpression(valueToAST(left), valueToAST(right))) return new Rational(1n);
  const leftRadical = rationalRadical(valueToAST(left));
  const rightRadical = rationalRadical(valueToAST(right));
  if (leftRadical && rightRadical && leftRadical.degree === rightRadical.degree) {
    const coefficient = leftRadical.coefficient.divide(rightRadical.coefficient);
    const root = rootValue(leftRadical.radicand.divide(rightRadical.radicand), leftRadical.degree);
    if (isRational(root)) return coefficient.multiply(root);
    if (isOne(coefficient)) return root;
    return symbolic(binaryNode('*', valueToAST(coefficient), valueToAST(root)), numeric(left) / numeric(right));
  }
  if (isRational(left) && rightRadical) return scale(rootValue(new Rational(1n).divide(rightRadical.radicand), rightRadical.degree), left.divide(rightRadical.coefficient));
  return symbolic(binaryNode('/', valueToAST(left), valueToAST(right)), numeric(left) / numeric(right));
};
