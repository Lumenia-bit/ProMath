import { MathError } from '../errors';
import { Rational } from '../rational';
import { expectArity, integer, type Operation } from '../value';
import { division } from './division';

export const fraction: Operation = (args, node, context) => {
  expectArity(args, 2);
  return division(args, node, context);
};
export const mixed: Operation = (args) => {
  expectArity(args, 3);
  const whole = integer(args[0], 'Целая часть');
  const numerator = integer(args[1], 'Числитель');
  const denominator = integer(args[2], 'Знаменатель');
  if (numerator < 0n || denominator <= 0n) throw new MathError('В смешанном числе числитель должен быть неотрицательным, знаменатель — положительным.');
  const fractional = new Rational(numerator, denominator);
  return new Rational(whole).add(whole < 0n ? fractional.negate() : fractional);
};
