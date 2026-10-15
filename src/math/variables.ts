import type { ASTNode } from './ast';
import { MathError } from './errors';
import { LIMITS } from './limits';
import { parse } from './parser';
import type { MathValue, SolverOptions } from './types';
import { valueToAST } from './value';

export interface VariableSubstitution { name: string; expression: ASTNode; value: MathValue }
export interface VariablePreparation { ast: ASTNode; substitutions: VariableSubstitution[]; variables: string[]; unresolvedVariables: string[] }

export function collectVariables(ast: ASTNode): string[] {
  const names = new Set<string>();
  let count = 0;
  const visit = (node: ASTNode, depth: number) => {
    if (++count > LIMITS.nodes || depth > LIMITS.depth) throw new MathError('Выражение слишком сложное. Уменьшите вложенность или число операций.', node.start, Math.max(1, node.end - node.start));
    if (node.type === 'variable') names.add(node.name);
    else if (node.type === 'binary') { visit(node.left, depth + 1); visit(node.right, depth + 1); }
    else if (node.type === 'function') node.args.forEach(argument => visit(argument, depth + 1));
    else if (node.type === 'unary' || node.type === 'factorial' || node.type === 'percentage') visit(node.argument, depth + 1);
  };
  visit(ast, 0);
  return [...names].sort();
}

export function prepareVariables(ast: ASTNode, options: SolverOptions, evaluateClosed: (ast: ASTNode) => MathValue): VariablePreparation {
  const variables = collectVariables(ast);
  const substitutions: VariableSubstitution[] = [];
  const replacements = new Map<string, ASTNode>();
  for (const name of variables) {
    if (!options.variables || !Object.prototype.hasOwnProperty.call(options.variables, name)) continue;
    const input = options.variables[name];
    if (typeof input !== 'string') throw new MathError(`Значение переменной ${name} должно быть числом или числовым выражением.`);
    if (!input.trim()) continue;
    try {
      const expression = parse(input);
      if (collectVariables(expression).length) throw new MathError('Значения переменных не могут зависеть от других переменных.');
      const value = evaluateClosed(expression);
      replacements.set(name, valueToAST(value));
      substitutions.push({ name, expression, value });
    } catch (error) {
      if (error instanceof MathError) throw new MathError(`Значение ${name}: ${error.message}`);
      throw error;
    }
  }
  const substitute = (node: ASTNode): ASTNode => {
    if (node.type === 'variable') return replacements.get(node.name) ?? node;
    if (node.type === 'binary') return { ...node, left: substitute(node.left), right: substitute(node.right) };
    if (node.type === 'function') return { ...node, args: node.args.map(substitute) };
    if (node.type === 'unary' || node.type === 'factorial' || node.type === 'percentage') return { ...node, argument: substitute(node.argument) };
    return node;
  };
  const substituted = replacements.size ? substitute(ast) : ast;
  return { ast: substituted, substitutions, variables, unresolvedVariables: collectVariables(substituted) };
}
