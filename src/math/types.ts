import type { ASTNode } from './ast';
import type { Rational } from './rational';

export type AngleMode = 'DEG' | 'RAD';
export interface SolverOptions { angleMode?: AngleMode; variables?: Readonly<Record<string, string>> }
export interface SymbolicValue { kind: 'symbolic'; expression: ASTNode; approximation: number }
export type MathValue = Rational | SymbolicValue;
export interface UnresolvedValue { kind: 'unresolved'; expression: ASTNode; variables: string[] }
export interface SolutionStep {
  type: 'operation' | 'simplification' | 'fraction' | 'result';
  before: string;
  operation: string;
  after: string;
  explanation: string;
  beforeLatex: string;
  operationLatex: string;
  afterLatex: string;
}
export interface Solution {
  ast: ASTNode;
  simplified: ASTNode;
  value: MathValue | UnresolvedValue;
  exact: string;
  approximate: string;
  latex: string;
  approximateLatex: string;
  expressionLatex: string;
  steps: SolutionStep[];
  angleMode: AngleMode;
  variables?: string[];
  unresolvedVariables?: string[];
  conditions?: string[];
}
