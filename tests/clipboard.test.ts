import { describe, expect, it } from 'vitest';
import { clipboardToLatex } from '../src/editor/clipboard';
import { latexToExpression } from '../src/editor/latex';
import { MathError, solve } from '../src/math';

describe('visual editor clipboard validation', () => {
  it.each([
    ['2+2', '4'],
    ['$2+2$', '4'],
    [' $$ 2+2 $$ ', '4'],
    ['$1/2+1/3$', '5/6'],
    [String.raw`\frac12+\frac13`, '5/6'],
    [String.raw`$\frac12$`, '1/2'],
    [String.raw`$$\sqrt{16}$$`, '4'],
    ['$$500+20%$$', '600'],
    [' $ 1.5e2 $ ', '150'],
  ])('validates %s and preserves its mathematics', (clipboard, expected) => {
    const latex = clipboardToLatex(clipboard);
    expect(latex).not.toContain('$');
    expect(solve(latexToExpression(latex)).exact).toBe(expected);
  });

  it.each([
    '', ' ', '$2+2', '2+2$', '$$2+2$', '$2+2$$', '$$$2+2$$$',
    '$$', '$ $2$ $', '$2$+1', '2$+2', 'alert(1)',
    String.raw`\unknown{2}`, String.raw`\text{alert(1)}`,
    String.raw`\frac{}{2}`, String.raw`$$\sqrt{}$$`,
  ])('rejects %s before passing it to MathLive', clipboard => {
    expect(() => clipboardToLatex(clipboard)).toThrow(MathError);
  });

  it('bounds clipboard size before conversion', () => {
    expect(() => clipboardToLatex('1'.repeat(5001))).toThrow(MathError);
  });
});
