import { Rational } from '../rational';
import { rationalRadical } from '../radical';
import { binaryNode, isRational, isZero, negate, numeric, sameExpression, scale, symbolic, valueToAST, type Operation } from '../value';
import { rootValue } from './root';

export const addition: Operation = ([left, right], node) => {
  if (node.type === 'binary' && node.right.type === 'percentage') {
    if (isRational(right)) return scale(left, new Rational(1n).add(right));
    return symbolic(binaryNode('*', valueToAST(left), binaryNode('+', valueToAST(new Rational(1n)), valueToAST(right))), numeric(left) * (1 + numeric(right)));
  }
  if (isRational(left) && isRational(right)) return left.add(right);
  if (isZero(left)) return right;
  if (isZero(right)) return left;
  if (sameExpression(valueToAST(left), valueToAST(negate(right)))) return new Rational(0n);
  const a = rationalRadical(valueToAST(left));
  const b = rationalRadical(valueToAST(right));
  if (a && b && a.degree === b.degree && a.radicand.equals(b.radicand)) return scale(rootValue(a.radicand, a.degree), a.coefficient.add(b.coefficient));
  if (sameExpression(valueToAST(left), valueToAST(right))) return symbolic(binaryNode('*', valueToAST(new Rational(2n)), valueToAST(left)), 2 * numeric(left));
  return symbolic(binaryNode('+', valueToAST(left), valueToAST(right)), numeric(left) + numeric(right));
};
