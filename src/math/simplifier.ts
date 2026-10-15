import type { ASTNode } from './ast';
import { Rational } from './rational';
import type { MathValue } from './types';
import { binaryNode, isRational, numberNode, sameExpression, symbolic, valueToAST } from './value';

function constantRational(node: ASTNode): Rational | undefined {
  if (node.type === 'number') return Rational.fromString(node.value);
  if (node.type === 'binary' && node.operator === '/') {
    const left = constantRational(node.left);
    const right = constantRational(node.right);
    if (left && right) return left.divide(right);
  }
  return undefined;
}
export function simplifyAST(node: ASTNode): ASTNode {
  if (node.type === 'unary') {
    const argument = simplifyAST(node.argument);
    if (node.operator === '+') return argument;
    if (argument.type === 'unary' && argument.operator === '-') return argument.argument;
    if (argument.type === 'number') return valueToAST(Rational.fromString(argument.value).negate());
    return { ...node, argument };
  }
  if (node.type === 'function') return { ...node, args: node.args.map(simplifyAST) };
  if (node.type === 'factorial' || node.type === 'percentage') return { ...node, argument: simplifyAST(node.argument) };
  if (node.type !== 'binary') return node;
  const left = simplifyAST(node.left);
  const right = simplifyAST(node.right);
  const a = constantRational(left);
  const b = constantRational(right);
  if (node.operator === '*') {
    if (a?.equals(new Rational(1n))) return right;
    if (b?.equals(new Rational(1n))) return left;
    if (a?.numerator === 0n || b?.numerator === 0n) return numberNode(0);
    if (a && right.type === 'binary' && right.operator === '*') {
      const nested = constantRational(right.left);
      if (nested) {
        const combined = a.multiply(nested);
        const coefficient = combined.denominator === 1n ? numberNode(combined.numerator) : binaryNode('/', numberNode(combined.numerator), numberNode(combined.denominator));
        return simplifyAST(binaryNode('*', coefficient, right.right));
      }
    }
    if (b && !a) return simplifyAST(binaryNode('*', right, left));
  }
  if (node.operator === '/') {
    if (b?.equals(new Rational(1n))) return left;
    if (left.type === 'binary' && left.operator === '/' && b) {
      const oldDenominator = constantRational(left.right);
      if (oldDenominator) {
        const denominator = oldDenominator.multiply(b);
        if (denominator.denominator === 1n) return simplifyAST(binaryNode('/', left.left, numberNode(denominator.numerator)));
      }
    }
  }
  if ((node.operator === '+' || node.operator === '-') && b?.numerator === 0n) return left;
  if (node.operator === '+' && a?.numerator === 0n) return right;
  if (node.operator === '-' && sameExpression(left, right)) return numberNode(0);
  return { ...node, left, right };
}
export function simplifyValue(value: MathValue): MathValue {
  if (isRational(value)) return value;
  const expression = simplifyAST(value.expression);
  const rational = constantRational(expression);
  return rational ?? symbolic(expression, value.approximation);
}
