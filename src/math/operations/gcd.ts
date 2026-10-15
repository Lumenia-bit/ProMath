import { bigintGcd, Rational } from '../rational';
import { expectArity, integer, type Operation } from '../value';

export const gcd: Operation = (args) => {
  expectArity(args, 2, 20);
  return new Rational(args.map(value => integer(value, 'Аргумент НОД')).reduce(bigintGcd));
};
