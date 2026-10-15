import { MathError } from '../errors';
import { LIMITS } from '../limits';
import { Rational } from '../rational';
import { expectArity, integer, type Operation } from '../value';

export const factorial: Operation = (args) => {
  expectArity(args, 1);
  const n = integer(args[0], 'Аргумент факториала');
  if (n < 0n) throw new MathError('Факториал определён только для неотрицательных целых чисел.');
  if (n > BigInt(LIMITS.factorial)) throw new MathError(`Факториал ограничен числом ${LIMITS.factorial}.`);
  let result = 1n;
  for (let value = 2n; value <= n; value += 1n) result *= value;
  return new Rational(result);
};
