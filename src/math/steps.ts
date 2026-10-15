import type { ASTNode } from './ast';
import type { EvaluationEvent } from './evaluator';
import { MathError } from './errors';
import { formatAST, formatExact, formatLatex, formatValueLatex } from './format';
import { bigintGcd, Rational } from './rational';
import { LIMITS } from './limits';
import type { MathValue, SolutionStep, UnresolvedValue } from './types';
import { isRational, sameExpression, valueToAST } from './value';
import { collectVariables } from './variables';

function replace(node: ASTNode, replacements: Map<ASTNode, ASTNode>): ASTNode {
  const replacement = replacements.get(node);
  if (replacement) return replacement;
  if (node.type === 'binary') return { ...node, left: replace(node.left, replacements), right: replace(node.right, replacements) };
  if (node.type === 'function') return { ...node, args: node.args.map(argument => replace(argument, replacements)) };
  if (node.type === 'unary' || node.type === 'factorial' || node.type === 'percentage') return { ...node, argument: replace(node.argument, replacements) };
  return node;
}
const explanations: Record<string, string> = {
  '+': 'Складываем значения.', '-': 'Вычитаем правое значение из левого.', '*': 'Умножаем значения.', '/': 'Делим и сокращаем дробь по НОД числителя и знаменателя.',
  '%': 'Находим остаток от деления (частное округляем к нулю).', '^': 'Возводим основание в степень.',
  sqrt: 'Извлекаем квадратный корень; полные квадраты выносим из-под корня.', cbrt: 'Извлекаем кубический корень.', root: 'Извлекаем корень указанной степени.',
  square: 'Возводим значение в квадрат.', factorial: 'Перемножаем целые числа от 1 до аргумента; 0! = 1.',
  abs: 'Находим расстояние числа до нуля.', log: 'Находим показатель степени заданного основания.', ln: 'Находим показатель степени основания e.',
  gcd: 'Находим НОД алгоритмом Евклида.', lcm: 'Находим НОК: |a × b| / НОД(a, b).',
  ncr: 'Вычисляем число сочетаний: n! / (r! × (n − r)!).', npr: 'Вычисляем число размещений: n! / (n − r)!.'
};
function explanation(event: EvaluationEvent): string {
  const { node } = event;
  if (node.type === 'binary') {
    if ((node.operator === '+' || node.operator === '-') && node.right.type === 'percentage') return `Вычисляем процент от левого значения и ${node.operator === '+' ? 'прибавляем' : 'вычитаем'} его.`;
    return explanations[node.operator];
  }
  if (node.type === 'factorial') return explanations.factorial;
  if (node.type === 'percentage') return 'Переводим проценты в долю: делим на 100.';
  if (node.type === 'unary') return node.operator === '-' ? 'Меняем знак значения.' : 'Унарный плюс сохраняет значение.';
  if (node.type === 'function') return explanations[node.name] ?? (['sin', 'cos', 'tan', 'cot'].includes(node.name) ? 'Вычисляем тригонометрическую функцию в выбранном режиме углов.' : ['asin', 'acos', 'atan'].includes(node.name) ? 'Находим угол в выбранном режиме углов.' : 'Вычисляем функцию.');
  return 'Упрощаем выражение.';
}
function fractionSteps(event: EvaluationEvent, before: ASTNode, after: ASTNode): SolutionStep[] {
  if (event.node.type !== 'binary' || !['+', '-'].includes(event.node.operator) || event.node.right.type === 'percentage') return [];
  const [left, right] = event.operands;
  if (!isRational(left) || !isRational(right) || left.denominator === right.denominator) return [];
  const common = left.denominator / bigintGcd(left.denominator, right.denominator) * right.denominator;
  const snapshot = formatAST(before);
  const snapshotLatex = formatLatex(before);
  const make = (operation: string, operationLatex: string, message: string): SolutionStep => ({ type: 'fraction', before: snapshot, after: snapshot, operation, explanation: message, beforeLatex: snapshotLatex, afterLatex: snapshotLatex, operationLatex });
  const steps = [make(`НОК ${left.denominator} и ${right.denominator} = ${common}`, `\\operatorname{lcm}(${left.denominator},${right.denominator}) = ${common}`, 'Находим наименьший общий знаменатель.')];
  for (const value of [left, right]) {
    if (value.denominator === common) continue;
    const numerator = value.numerator * (common / value.denominator);
    steps.push(make(`${value.toString()} = ${numerator}/${common}`, `${formatValueLatex(value)} = \\frac{${numerator}}{${common}}`, `Умножаем числитель и знаменатель на ${common / value.denominator}.`));
  }
  const leftNumerator = left.numerator * (common / left.denominator);
  const rightNumerator = right.numerator * (common / right.denominator);
  const resultStep = make(`${leftNumerator}/${common} ${event.node.operator} ${rightNumerator}/${common} = ${formatExact(event.value)}`, `\\frac{${leftNumerator}}{${common}} ${event.node.operator} \\frac{${rightNumerator}}{${common}} = ${formatValueLatex(event.value)}`, 'Складываем или вычитаем числители и сохраняем общий знаменатель, затем сокращаем результат.');
  resultStep.after = formatAST(after);
  resultStep.afterLatex = formatLatex(after);
  steps.push(resultStep);
  return steps;
}
export function generateSteps(ast: ASTNode, events: EvaluationEvent[], value: MathValue | UnresolvedValue): SolutionStep[] {
  const steps: SolutionStep[] = [];
  let characters = 0;
  const append = (step: SolutionStep) => {
    characters += step.before.length + step.operation.length + step.after.length + step.beforeLatex.length + step.operationLatex.length + step.afterLatex.length;
    if (characters > LIMITS.solutionCharacters) throw new MathError('Пошаговое решение слишком объёмное. Разбейте выражение на несколько вычислений.');
    steps.push(step);
  };
  const replacements = new Map<ASTNode, ASTNode>();
  for (const event of events) {
    const before = replace(ast, replacements);
    const operation = replace(event.node, replacements);
    const afterOperation = valueToAST(event.value);
    replacements.set(event.node, afterOperation);
    const after = replace(ast, replacements);
    if (sameExpression(operation, afterOperation)) continue;
    const fractions = fractionSteps(event, before, after);
    fractions.forEach(append);
    if (fractions.length) continue;
    append({
      type: 'operation', before: formatAST(before), operation: `${formatAST(operation)} = ${formatExact(event.value)}`, after: formatAST(after), explanation: explanation(event),
      beforeLatex: formatLatex(before), operationLatex: `${formatLatex(operation)} = ${formatValueLatex(event.value)}`, afterLatex: formatLatex(after),
    });
  }
  const finalAST = value instanceof Rational ? valueToAST(value) : value.expression;
  const exact = value instanceof Rational ? value.toString() : formatAST(finalAST);
  const latex = formatLatex(finalAST);
  const current = replace(ast, replacements);
  const unresolved = !(value instanceof Rational) && value.kind === 'unresolved';
  const algebraChanged = collectVariables(ast).length > 0 && !sameExpression(current, finalAST);
  if (algebraChanged) append({ type: 'simplification', before: formatAST(current), operation: `${formatAST(current)} = ${exact}`, after: exact, explanation: 'Вычисляем числовые части выражения, приводим подобные члены и упрощаем коэффициенты.', beforeLatex: formatLatex(current), operationLatex: `${formatLatex(current)} = ${latex}`, afterLatex: latex });
  append({ type: 'result', before: unresolved || algebraChanged ? exact : formatAST(current), operation: exact, after: exact, explanation: unresolved ? 'Точное выражение с неизвестными. Задайте их значения для числового ответа.' : 'Итоговый точный результат.', beforeLatex: unresolved || algebraChanged ? latex : formatLatex(current), operationLatex: latex, afterLatex: latex });
  return steps;
}
