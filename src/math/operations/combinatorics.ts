import { MathError } from '../errors';
import { LIMITS } from '../limits';
import { Rational } from '../rational';
import { expectArity, integer, type Operation } from '../value';

function argumentsFor(args: Parameters<Operation>[0]): [bigint, bigint] {
  expectArity(args, 2);
  const n = integer(args[0], 'n');
  const r = integer(args[1], 'r');
  if (n < 0n || r < 0n || r > n) throw new MathError('Для nCr и nPr нужны целые числа: 0 ≤ r ≤ n.');
  if (n > BigInt(LIMITS.factorial)) throw new MathError(`nCr и nPr ограничены n ≤ ${LIMITS.factorial}.`);
  return [n, r];
}
export const combinations: Operation = (args) => {
  const [n, r] = argumentsFor(args);
  const k = r < n - r ? r : n - r;
  let result = 1n;
  for (let index = 1n; index <= k; index += 1n) result = result * (n - k + index) / index;
  return new Rational(result);
};
export const permutations: Operation = (args) => {
  const [n, r] = argumentsFor(args);
  let result = 1n;
  for (let index = 0n; index < r; index += 1n) result *= n - index;
  return new Rational(result);
};
