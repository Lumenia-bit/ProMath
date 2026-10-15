import { Rational } from '../rational';
import { division } from './division';
import type { Operation } from '../value';

export const percentage: Operation = ([value], node, context) => division([value, new Rational(100n)], node, context);
