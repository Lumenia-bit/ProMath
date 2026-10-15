import { describe, expect, it } from 'vitest';
import { parse } from '../src/math/parser';
import type { ASTNode } from '../src/math/ast';

function children(node: ASTNode): ASTNode[] {
  if (node.type === 'binary') return [node.left, node.right];
  if (node.type === 'function') return node.args;
  if (node.type === 'unary' || node.type === 'factorial' || node.type === 'percentage') return [node.argument];
  return [];
}

describe('AST', () => {
  it('keeps constants and functions as typed nodes', () => {
    expect(parse('pi')).toMatchObject({ type: 'constant', name: 'pi' });
    expect(parse('5!')).toMatchObject({ type: 'factorial' });
    expect(parse('abs(-3)')).toMatchObject({ type: 'function', name: 'abs',
      args: [{ type: 'unary', operator: '-' }] });
  });

  it('preserves bigint-compatible literals without premature Number conversion', () => {
    expect(parse('9007199254740993')).toMatchObject({ type: 'number', value: '9007199254740993' });
    expect(parse('1.2e-5')).toMatchObject({ type: 'number', value: '1.2e-5' });
  });

  it('retains valid source spans on every node', () => {
    const input = '2 + 3 * sqrt(16)';
    const visit = (node: ASTNode) => {
      expect(node.start).toBeGreaterThanOrEqual(0);
      expect(node.end).toBeLessThanOrEqual(input.length);
      expect(node.start).toBeLessThan(node.end);
      for (const child of children(node)) {
        expect(child.start).toBeGreaterThanOrEqual(node.start);
        expect(child.end).toBeLessThanOrEqual(node.end);
        visit(child);
      }
    };
    visit(parse(input));
  });

  it('represents parentheses through tree structure', () => {
    expect(parse('(2+3)*4')).toMatchObject({ type: 'binary', operator: '*',
      left: { type: 'binary', operator: '+' }, right: { type: 'number', value: '4' } });
  });
});
