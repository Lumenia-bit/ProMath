import { Rational } from '../rational';
import { rationalRadical } from '../radical';
import { binaryNode, isRational, isZero, negate, numeric, sameExpression, scale, symbolic, valueToAST, type Operation } from '../value';
import { rootValue } from './root';

export const subtraction: Operation = ([left, right], node) => {
  if (node.type === 'binary' && node.right.type === 'percentage') {
    if (isRational(right)) return scale(left, new Rational(1n).subtract(right));
    return symbolic(binaryNode('*', valueToAST(left), binaryNode('-', valueToAST(new Rational(1n)), valueToAST(right))), numeric(left) * (1 - numeric(right)));
  }
  if (isRational(left) && isRational(right)) return left.subtract(right);
  if (sameExpression(valueToAST(left), valueToAST(right))) return new Rational(0n);
  if (isZero(right)) return left;
  if (isZero(left)) return negate(right);
  const a = rationalRadical(valueToAST(left));
  const b = rationalRadical(valueToAST(right));
  if (a && b && a.degree === b.degree && a.radicand.equals(b.radicand)) return scale(rootValue(a.radicand, a.degree), a.coefficient.subtract(b.coefficient));
  return symbolic(binaryNode('-', valueToAST(left), valueToAST(right)), numeric(left) - numeric(right));
};
