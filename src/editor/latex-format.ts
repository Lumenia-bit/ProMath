import type { ASTNode } from '../math/ast';

const scientificNumber = (node: ASTNode) => node.type === 'number' && /[eE]/.test(node.value);
const simpleWhole = (node: ASTNode): boolean => node.type === 'number' ? /^\d+$/.test(node.value)
  : node.type === 'unary' && node.argument.type === 'number' && /^\d+$/.test(node.argument.value)
    && !(node.operator === '-' && /^0+$/.test(node.argument.value));

function precedence(node: ASTNode): number {
  if (scientificNumber(node)) return 50;
  if (node.type === 'binary') return ({ '+': 40, '-': 40, '*': 50, '/': 50, '%': 50, '^': 70 })[node.operator];
  if (node.type === 'unary') return 60;
  if (node.type === 'factorial' || node.type === 'percentage') return 90;
  if (node.type === 'function' && node.name === 'mixed' && simpleWhole(node.args[0])) return 40;
  return 100;
}

function child(node: ASTNode, priority: number, equal = false): string {
  const output = editorLatex(node);
  return precedence(node) < priority || (equal && precedence(node) === priority)
    ? `\\left(${output}\\right)` : output;
}

/** Renders editable cells; scientific literals need their own precedence once expanded. */
export function editorLatex(node: ASTNode): string {
  if (node.type === 'number') {
    const match = node.value.match(/^(.+)[eE]([+-]?\d+)$/);
    return match ? `${match[1]}\\times 10^{${Number(match[2])}}` : node.value;
  }
  if (node.type === 'constant') return node.name === 'pi' ? '\\pi' : '\\exponentialE';
  if (node.type === 'variable') return node.name;
  if (node.type === 'unary') return `${node.operator}${child(node.argument, 60)}`;
  if (node.type === 'factorial' || node.type === 'percentage') return `${child(node.argument, 90)}${node.type === 'factorial' ? '!' : '\\%'}`;
  if (node.type === 'function') {
    const args = node.args.map(editorLatex);
    if (node.name === 'sqrt' && args.length === 1) return `\\sqrt{${args[0]}}`;
    if (node.name === 'cbrt' && args.length === 1) return `\\sqrt[3]{${args[0]}}`;
    if (node.name === 'root' && args.length === 2) return `\\sqrt[${args[1]}]{${args[0]}}`;
    if (node.name === 'abs' && args.length === 1) return `\\left|${args[0]}\\right|`;
    if (node.name === 'factorial' && args.length === 1) return `${child(node.args[0], 90)}!`;
    if (node.name === 'square' && args.length === 1) return `${child(node.args[0], 70, true)}^{2}`;
    if (node.name === 'frac' && args.length === 2) return `\\frac{${args[0]}}{${args[1]}}`;
    if (node.name === 'mixed' && args.length === 3 && simpleWhole(node.args[0])) return `${args[0]}\\,\\frac{${args[1]}}{${args[2]}}`;
    if (node.name === 'ncr' && args.length === 2) return `\\binom{${args[0]}}{${args[1]}}`;
    if (node.name === 'log' && args.length === 2) return `\\log_{${args[1]}}\\left(${args[0]}\\right)`;
    const names: Record<string, string> = { asin: 'arcsin', acos: 'arccos', atan: 'arctan' };
    const standard = ['sin', 'cos', 'tan', 'cot', 'asin', 'acos', 'atan', 'ln', 'log'].includes(node.name);
    const name = standard ? `\\${names[node.name] ?? node.name}` : `\\operatorname{${node.name}}`;
    return `${name}\\left(${args.join(',\\,')}\\right)`;
  }
  if (node.operator === '/') return `\\frac{${editorLatex(node.left)}}{${editorLatex(node.right)}}`;
  if (node.operator === '^') return `${child(node.left, 70, true)}^{${editorLatex(node.right)}}`;
  const priority = precedence(node);
  const operator = ({ '*': '\\times', '%': '\\bmod' } as Record<string, string>)[node.operator] ?? node.operator;
  const rightEqual = node.operator === '+' || node.operator === '-' || node.operator === '%'
    || (node.operator === '*' && node.right.type === 'binary' && node.right.operator === '%');
  return `${child(node.left, priority)} ${operator} ${child(node.right, priority, rightEqual)}`;
}
