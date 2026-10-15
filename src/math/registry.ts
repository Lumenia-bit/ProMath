import type { BinaryOperator } from './ast';
import type { Operation } from './value';
import { absolute } from './operations/absolute';
import { addition } from './operations/addition';
import { combinations, permutations } from './operations/combinatorics';
import { division } from './operations/division';
import { factorial } from './operations/factorial';
import { fraction, mixed } from './operations/fraction';
import { gcd } from './operations/gcd';
import { lcm } from './operations/lcm';
import { logarithm, naturalLogarithm } from './operations/logarithm';
import { multiplication } from './operations/multiplication';
import { power, square } from './operations/power';
import { remainder } from './operations/remainder';
import { cubeRoot, nthRoot, squareRoot } from './operations/root';
import { subtraction } from './operations/subtraction';
import { arccosine, arcsine, arctangent, cosine, cotangent, sine, tangent } from './operations/trigonometry';

export const operatorRegistry: Readonly<Record<BinaryOperator, Operation>> = Object.freeze({ '+': addition, '-': subtraction, '*': multiplication, '/': division, '%': remainder, '^': power });
export const functionRegistry: Readonly<Record<string, Operation>> = Object.freeze({
  sqrt: squareRoot, cbrt: cubeRoot, root: nthRoot, square,
  sin: sine, cos: cosine, tan: tangent, cot: cotangent, asin: arcsine, acos: arccosine, atan: arctangent,
  log: logarithm, ln: naturalLogarithm, abs: absolute, factorial,
  ncr: combinations, npr: permutations, gcd, lcm, mod: remainder, frac: fraction, mixed,
});
