import { evaluateWithTrace } from './evaluator';
import { approximateLatex, formatApproximate, formatAST, formatExact, formatLatex, formatValueLatex } from './format';
import { parse } from './parser';
import { generateSteps } from './steps';
import type { Solution, SolutionStep, SolverOptions, UnresolvedValue } from './types';
import { valueToAST } from './value';
import { simplifyAlgebra } from './algebra';
import { collectVariables, prepareVariables, type VariablePreparation } from './variables';
import { MathError } from './errors';
import { LIMITS } from './limits';

function boundedSteps(prefix: SolutionStep[], steps: SolutionStep[]): SolutionStep[] {
  const result = [...prefix, ...steps];
  const characters = result.reduce((count, step) => count + step.before.length + step.operation.length + step.after.length + step.beforeLatex.length + step.operationLatex.length + step.afterLatex.length, 0);
  if (characters > LIMITS.solutionCharacters) throw new MathError('Пошаговое решение слишком объёмное. Разбейте выражение на несколько вычислений.');
  return result;
}

function substitutionSteps(original: Solution['ast'], prepared: VariablePreparation): SolutionStep[] {
  if (!prepared.substitutions.length) return [];
  const assignment = prepared.substitutions.map(({ name, value }) => `${name} = ${formatExact(value)}`).join(', ');
  const assignmentLatex = prepared.substitutions.map(({ name, value }) => `${name} = ${formatValueLatex(value)}`).join(',\\quad ');
  return [{ type: 'simplification', before: formatAST(original), operation: assignment, after: formatAST(prepared.ast), explanation: `Подставляем заданные значения: ${assignment}.`, beforeLatex: formatLatex(original), operationLatex: assignmentLatex, afterLatex: formatLatex(prepared.ast) }];
}

export function solve(input: string, options: SolverOptions = {}): Solution {
  const ast = parse(input);
  const angleMode = options.angleMode ?? 'RAD';
  const numericOptions: SolverOptions = { angleMode };
  const prepared = prepareVariables(ast, options, expression => evaluateWithTrace(expression, numericOptions).value);
  const prefix = substitutionSteps(ast, prepared);
  const algebra = prepared.unresolvedVariables.length ? simplifyAlgebra(prepared.ast, expression => evaluateWithTrace(expression, numericOptions)) : undefined;
  const simplified = algebra?.ast ?? prepared.ast;
  const unresolvedVariables = collectVariables(simplified);
  if (unresolvedVariables.length) {
    const value: UnresolvedValue = { kind: 'unresolved', expression: simplified, variables: unresolvedVariables };
    return { ast, simplified, value, exact: formatAST(simplified), approximate: '', latex: formatLatex(simplified), approximateLatex: '', expressionLatex: formatLatex(ast), steps: boundedSteps(prefix, generateSteps(prepared.ast, algebra?.events ?? [], value)), angleMode, variables: prepared.variables, unresolvedVariables, conditions: algebra?.conditions ?? [] };
  }
  const { value, events } = evaluateWithTrace(simplified, numericOptions);
  const approximate = formatApproximate(value);
  return { ast, simplified: valueToAST(value), value, exact: formatExact(value), approximate, latex: formatValueLatex(value), approximateLatex: approximateLatex(approximate), expressionLatex: formatLatex(ast), steps: boundedSteps(prefix, generateSteps(prepared.ast, [...(algebra?.events ?? []), ...events], value)), angleMode, variables: prepared.variables, unresolvedVariables, conditions: algebra?.conditions ?? [] };
}
export { evaluate, evaluateWithTrace } from './evaluator';
export { MathError } from './errors';
export { formatAST, formatLatex, formatExact, formatApproximate } from './format';
export { parse } from './parser';
export { Rational, bigintGcd } from './rational';
export { simplifyAST, simplifyValue } from './simplifier';
export { generateSteps } from './steps';
export { tokenize } from './tokenizer';
export { functionRegistry, operatorRegistry } from './registry';
export { collectVariables } from './variables';
export { simplifyAlgebra } from './algebra';
export type * from './ast';
export type * from './types';
