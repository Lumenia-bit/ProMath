import { MathError } from '../errors';
import { binaryNode, expectArity, isRational, numeric, symbolic, valueToAST, type Operation } from '../value';

export const remainder: Operation = (args) => {
  expectArity(args, 2);
  const [left, right] = args;
  if ((isRational(right) && right.numerator === 0n) || (!isRational(right) && numeric(right) === 0)) throw new MathError('Остаток от деления на ноль не определён.');
  if (isRational(left) && isRational(right)) return left.modulo(right);
  return symbolic(binaryNode('%', valueToAST(left), valueToAST(right)), numeric(left) % numeric(right));
};
