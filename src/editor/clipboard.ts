import { MathError } from '../math/errors';
import { expressionToLatex, latexToExpression } from './latex';
import { MAX_LATEX_LENGTH } from './latex-tokens';

/** Validate the complete clipboard expression before it reaches the visual renderer. */
export function clipboardToLatex(text: string): string {
  if (text.length > MAX_LATEX_LENGTH) throw new MathError('Формула слишком длинная. Разбейте её на несколько выражений.');
  let expression = text.trim();
  const opening = expression.match(/^\$+/)?.[0].length ?? 0;
  const closing = expression.match(/\$+$/)?.[0].length ?? 0;
  if (opening || closing) {
    if (opening !== closing || (opening !== 1 && opening !== 2) || expression.length <= opening + closing) {
      throw new MathError('Формула должна быть заключена в парные $ или $$.');
    }
    expression = expression.slice(opening, -closing).trim();
    if (expression.includes('$')) throw new MathError('Вставьте одно выражение внутри парных $ или $$.');
  }
  return expressionToLatex(expression.includes('\\') ? latexToExpression(expression) : expression);
}
