import { Rational } from '../rational';
import { rationalRadical } from '../radical';
import { binaryNode, isOne, isRational, isZero, negate, numeric, symbolic, valueToAST, type Operation } from '../value';
import { rootValue } from './root';

export const multiplication: Operation = ([left, right]) => {
  if (isRational(left) && isRational(right)) return left.multiply(right);
  if (isZero(left) || isZero(right)) return new Rational(0n);
  if (isOne(left)) return right;
  if (isOne(right)) return left;
  if (isRational(left) && left.equals(new Rational(-1n))) return negate(right);
  if (isRational(right) && right.equals(new Rational(-1n))) return negate(left);
  const leftAST = valueToAST(left);
  const rightAST = valueToAST(right);
  const leftRadical = rationalRadical(leftAST);
  const rightRadical = rationalRadical(rightAST);
  if (leftRadical && rightRadical && leftRadical.degree === rightRadical.degree) {
    const coefficient = leftRadical.coefficient.multiply(rightRadical.coefficient);
    const root = rootValue(leftRadical.radicand.multiply(rightRadical.radicand), leftRadical.degree);
    if (isRational(root)) return coefficient.multiply(root);
    if (isOne(coefficient)) return root;
    return symbolic(binaryNode('*', valueToAST(coefficient), valueToAST(root)), numeric(left) * numeric(right));
  }
  return symbolic(binaryNode('*', leftAST, rightAST), numeric(left) * numeric(right));
};
