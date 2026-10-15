import type { ASTNode } from './ast';
import { MathError } from './errors';
import { LIMITS } from './limits';
import { factorial } from './operations/factorial';
import { percentage } from './operations/percentage';
import { Rational } from './rational';
import { functionRegistry, operatorRegistry } from './registry';
import { simplifyValue } from './simplifier';
import type { MathValue, SolverOptions } from './types';
import { negate, symbolic, type OperationContext } from './value';
import { prepareVariables, type VariableSubstitution } from './variables';

export interface EvaluationEvent { node: ASTNode; operands: MathValue[]; value: MathValue }
export interface EvaluationTrace { value: MathValue; events: EvaluationEvent[]; ast: ASTNode; substitutions: VariableSubstitution[] }

export function evaluateWithTrace(ast: ASTNode, options: SolverOptions = {}): EvaluationTrace {
  const prepared = prepareVariables(ast, options, expression => evaluateWithTrace(expression, { angleMode: options.angleMode }).value);
  if (prepared.unresolvedVariables.length) throw new MathError(`Укажите значение переменной ${prepared.unresolvedVariables[0]}.`);
  const context: OperationContext = { angleMode: options.angleMode ?? 'RAD' };
  const events: EvaluationEvent[] = [];
  let count = 0;
  const visit = (node: ASTNode, depth: number, suppressSelf = false): MathValue => {
    count += 1;
    if (depth > LIMITS.depth || count > LIMITS.nodes) throw new MathError('Выражение слишком сложное. Уменьшите вложенность или число операций.', node.start, Math.max(1, node.end - node.start));
    try {
      if (node.type === 'number') return Rational.fromString(node.value);
      if (node.type === 'constant') return symbolic(node, node.name === 'pi' ? Math.PI : Math.E);
      if (node.type === 'variable') throw new MathError(`Укажите значение переменной ${node.name}.`, node.start, Math.max(1, node.end - node.start));
      let operands: MathValue[];
      let value: MathValue;
      if (node.type === 'binary') {
        const relative = (node.operator === '+' || node.operator === '-') && node.right.type === 'percentage';
        operands = [visit(node.left, depth + 1), visit(node.right, depth + 1, relative)];
        const operation = operatorRegistry[node.operator];
        if (!operation) throw new MathError('Неизвестный математический оператор.');
        value = operation(operands, node, context);
      } else if (node.type === 'function') {
        const operation = functionRegistry[node.name];
        if (!operation) throw new MathError(`Неизвестная функция «${node.name}».`);
        operands = node.args.map(argument => visit(argument, depth + 1));
        value = operation(operands, node, context);
      } else {
        operands = [visit(node.argument, depth + 1)];
        if (node.type === 'unary') value = node.operator === '-' ? negate(operands[0]) : operands[0];
        else value = (node.type === 'factorial' ? factorial : percentage)(operands, node, context);
      }
      value = simplifyValue(value);
      if (!suppressSelf) events.push({ node, operands, value });
      return value;
    } catch (error) {
      if (error instanceof MathError && error.position === 0 && error.length === 1) throw new MathError(error.message, node.start, Math.max(1, node.end - node.start));
      throw error;
    }
  };
  return { value: visit(prepared.ast, 0), events, ast: prepared.ast, substitutions: prepared.substitutions };
}
export const evaluate = (ast: ASTNode, options: SolverOptions = {}): MathValue => evaluateWithTrace(ast, options).value;
