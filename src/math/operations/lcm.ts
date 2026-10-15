import { bigintGcd, Rational } from '../rational';
import { expectArity, integer, type Operation } from '../value';

export const lcm: Operation = (args) => {
  expectArity(args, 2, 20);
  const result = args.map(value => integer(value, 'Аргумент НОК')).reduce((left, right) => left === 0n || right === 0n ? 0n : new Rational(left / bigintGcd(left, right)).multiply(new Rational(right)).numerator);
  return new Rational(result < 0n ? -result : result);
};
