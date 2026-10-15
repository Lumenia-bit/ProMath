import type { ASTNode } from './ast';
import { Rational } from './rational';
import type { MathValue } from './types';
import { isRational, valueToAST } from './value';

const priorities: Record<ASTNode['type'], number> = { number: 100, constant: 100, variable: 100, function: 100, factorial: 90, percentage: 90, unary: 60, binary: 0 };
function precedence(node: ASTNode): number {
  if (node.type !== 'binary') return priorities[node.type];
  return ({ '+': 40, '-': 40, '*': 50, '/': 50, '%': 50, '^': 70 })[node.operator];
}
function negativeLiteral(node: ASTNode): boolean { return node.type === 'number' && node.value.startsWith('-'); }
function child(node: ASTNode, parent: number, latex: boolean, equal = false): string {
  const output = render(node, latex);
  const needs = precedence(node) < parent || (equal && precedence(node) === parent) || (negativeLiteral(node) && parent >= 70);
  return needs ? latex ? `\\left(${output}\\right)` : `(${output})` : output;
}
function render(node: ASTNode, latex: boolean): string {
  if (node.type === 'number') {
    if (!latex) return node.value;
    const match = node.value.match(/^(.+)[eE]([+-]?\d+)$/);
    return match ? `${match[1]} \\times 10^{${Number(match[2])}}` : node.value;
  }
  if (node.type === 'constant') return node.name === 'pi' ? latex ? '\\pi' : 'pi' : latex ? '\\mathrm{e}' : 'e';
  if (node.type === 'variable') return !latex && node.name === 'e' ? 'var(e)' : node.name;
  if (node.type === 'unary') return `${node.operator}${child(node.argument, 60, latex)}`;
  if (node.type === 'factorial' || node.type === 'percentage') return `${child(node.argument, 90, latex)}${node.type === 'factorial' ? '!' : latex ? '\\%' : '%'}`;
  if (node.type === 'function') {
    const args = node.args.map(arg => render(arg, latex));
    if (!latex) return `${node.name}(${args.join(', ')})`;
    if (node.name === 'sqrt') return `\\sqrt{${args[0]}}`;
    if (node.name === 'cbrt') return `\\sqrt[3]{${args[0]}}`;
    if (node.name === 'root') return `\\sqrt[${args[1]}]{${args[0]}}`;
    if (node.name === 'abs') return `\\left|${args[0]}\\right|`;
    if (node.name === 'factorial') return `${child(node.args[0], 90, true)}!`;
    if (node.name === 'square') return `${child(node.args[0], 70, true)}^{2}`;
    if (node.name === 'frac') return `\\frac{${args[0]}}{${args[1]}}`;
    if (node.name === 'mixed') return `${args[0]}\\,\\frac{${args[1]}}{${args[2]}}`;
    if (node.name === 'ncr') return `\\binom{${args[0]}}{${args[1]}}`;
    if (node.name === 'log' && args.length === 2) return `\\log_{${args[1]}}\\left(${args[0]}\\right)`;
    const standard = new Set(['sin', 'cos', 'tan', 'cot', 'asin', 'acos', 'atan', 'ln', 'log']);
    const name = standard.has(node.name) ? ({ asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan' } as Record<string, string>)[node.name] ?? `\\${node.name}` : `\\operatorname{${node.name}}`;
    return `${name}\\left(${args.join(',\\,')}\\right)`;
  }
  if (node.operator === '/') {
    if (latex) return `\\frac{${render(node.left, true)}}{${render(node.right, true)}}`;
    return `${child(node.left, 50, false)}/${child(node.right, 50, false, true)}`;
  }
  if (node.operator === '^') {
    const left = negativeLiteral(node.left) ? latex ? `\\left(${render(node.left, true)}\\right)` : `(${render(node.left, false)})` : child(node.left, 70, latex, true);
    return latex ? `${left}^{${render(node.right, true)}}` : `${left}^${child(node.right, 70, false)}`;
  }
  const left = child(node.left, precedence(node), latex);
  const right = child(node.right, precedence(node), latex, node.operator === '+' || node.operator === '-' || node.operator === '%' || (node.operator === '*' && node.right.type === 'binary' && (node.right.operator === '/' || node.right.operator === '%')));
  const operator = latex ? ({ '*': '\\times', '%': '\\bmod' } as Record<string, string>)[node.operator] ?? node.operator : node.operator;
  return `${left} ${operator} ${right}`;
}
export const formatAST = (node: ASTNode): string => render(node, false);
export const formatLatex = (node: ASTNode): string => render(node, true);
export const formatExact = (value: MathValue): string => isRational(value) ? value.toString() : formatAST(value.expression);
export const formatValueLatex = (value: MathValue): string => formatLatex(valueToAST(value));

function scientificRational(value: Rational): string {
  const sign = value.numerator < 0n ? '-' : '';
  const numerator = (value.numerator < 0n ? -value.numerator : value.numerator).toString();
  const denominator = value.denominator.toString();
  const n = Number(numerator.slice(0, 16)) / 10 ** (Math.min(numerator.length, 16) - 1);
  const d = Number(denominator.slice(0, 16)) / 10 ** (Math.min(denominator.length, 16) - 1);
  let exponent = numerator.length - denominator.length;
  let mantissa = n / d;
  if (mantissa < 1) { mantissa *= 10; exponent -= 1; }
  if (mantissa >= 10) { mantissa /= 10; exponent += 1; }
  return `${sign}${Number(mantissa.toFixed(10))}e${exponent >= 0 ? '+' : ''}${exponent}`;
}
export function formatApproximate(value: MathValue): string {
  const approximate = isRational(value) ? value.toNumber() : value.approximation;
  if (isRational(value) && (!Number.isFinite(approximate) || (approximate === 0 && value.numerator !== 0n))) return scientificRational(value);
  if (approximate === 0) return '0';
  if (Math.abs(approximate) >= 1e12 || Math.abs(approximate) < 1e-7) return approximate.toExponential(10).replace(/(\.\d*?[1-9])0+(?=e)|\.0+(?=e)/, '$1');
  return approximate.toFixed(10).replace(/\.?0+$/, '');
}
export function approximateLatex(output: string): string {
  const parts = output.split('e');
  return parts.length === 2 ? `${parts[0]} \\times 10^{${Number(parts[1])}}` : output;
}
