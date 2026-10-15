import type { ASTNode } from './ast';
import { Rational } from './rational';

export interface RationalRadical { coefficient: Rational; radicand: Rational; degree: number }

export function rationalFromAST(node: ASTNode): Rational | undefined {
  if (node.type === 'number') return Rational.fromString(node.value);
  if (node.type === 'unary') { const value = rationalFromAST(node.argument); return node.operator === '-' ? value?.negate() : value; }
  if (node.type === 'binary' && node.operator === '/') {
    const numerator = rationalFromAST(node.left);
    const denominator = rationalFromAST(node.right);
    if (numerator && denominator) return numerator.divide(denominator);
  }
  return undefined;
}
export function rationalRadical(node: ASTNode): RationalRadical | undefined {
  if (node.type === 'function' && ['sqrt', 'cbrt', 'root'].includes(node.name)) {
    const radicand = rationalFromAST(node.args[0]);
    const index = node.name === 'root' ? rationalFromAST(node.args[1]) : new Rational(node.name === 'sqrt' ? 2n : 3n);
    if (radicand && index?.isInteger && index.numerator >= 2n && index.numerator <= 1000n) return { coefficient: new Rational(1n), radicand, degree: Number(index.numerator) };
  }
  if (node.type === 'unary' && node.operator === '-') {
    const radical = rationalRadical(node.argument);
    if (radical) return { ...radical, coefficient: radical.coefficient.negate() };
  }
  if (node.type === 'binary' && node.operator === '*') {
    const leftCoefficient = rationalFromAST(node.left);
    const rightRadical = rationalRadical(node.right);
    if (leftCoefficient && rightRadical) return { ...rightRadical, coefficient: leftCoefficient.multiply(rightRadical.coefficient) };
    const rightCoefficient = rationalFromAST(node.right);
    const leftRadical = rationalRadical(node.left);
    if (rightCoefficient && leftRadical) return { ...leftRadical, coefficient: rightCoefficient.multiply(leftRadical.coefficient) };
  }
  if (node.type === 'binary' && node.operator === '/') {
    const radical = rationalRadical(node.left);
    const denominator = rationalFromAST(node.right);
    if (radical && denominator) return { ...radical, coefficient: radical.coefficient.divide(denominator) };
  }
  return undefined;
}
