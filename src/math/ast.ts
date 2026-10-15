export interface SourceSpan { start: number; end: number }
export type BinaryOperator = '+' | '-' | '*' | '/' | '%' | '^';
export interface NumberNode extends SourceSpan { type: 'number'; value: string }
export interface ConstantNode extends SourceSpan { type: 'constant'; name: 'pi' | 'e' }
export interface VariableNode extends SourceSpan { type: 'variable'; name: string }
export interface BinaryExpression extends SourceSpan { type: 'binary'; operator: BinaryOperator; left: ASTNode; right: ASTNode }
export interface UnaryExpression extends SourceSpan { type: 'unary'; operator: '+' | '-'; argument: ASTNode }
export interface FunctionCall extends SourceSpan { type: 'function'; name: string; args: ASTNode[] }
export interface FactorialExpression extends SourceSpan { type: 'factorial'; argument: ASTNode }
export interface PercentageExpression extends SourceSpan { type: 'percentage'; argument: ASTNode }
export type ASTNode = NumberNode | ConstantNode | VariableNode | BinaryExpression | UnaryExpression | FunctionCall | FactorialExpression | PercentageExpression;

export const FUNCTION_NAMES = new Set([
  'sqrt', 'cbrt', 'root', 'square', 'sin', 'cos', 'tan', 'cot', 'asin', 'acos', 'atan',
  'log', 'ln', 'abs', 'factorial', 'ncr', 'npr', 'gcd', 'lcm', 'mod', 'frac', 'mixed', 'var',
]);
