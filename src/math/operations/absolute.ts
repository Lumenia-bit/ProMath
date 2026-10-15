import { expectArity, isRational, negate, numeric, type Operation } from '../value';

export const absolute: Operation = (args) => {
  expectArity(args, 1);
  const value = args[0];
  return isRational(value) ? value.abs() : numeric(value) < 0 ? negate(value) : value;
};
