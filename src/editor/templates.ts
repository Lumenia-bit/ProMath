import { MathError } from '../math/errors';
import type { Insertion } from '../utils/editing';

export interface EditorInsertion {
  latex: string;
  selectionMode: 'placeholder' | 'after';
}

// MathLive preserves the selection with #0; #@ also captures the previous operand.
const templates: Readonly<Record<string, string>> = {
  '/': String.raw`\frac{#@}{#?}`,
  '÷': String.raw`\frac{#@}{#?}`,
  'frac(,)': String.raw`\frac{#0}{#?}`,
  '^': '#@^{#?}',
  '^2': '#@^{2}',
  'e^()': String.raw`\exponentialE^{#0}`,
  'reciprocal()': String.raw`\frac{1}{#@}`,
  'paren()': String.raw`\left(#0\right)`,
  'sqrt()': String.raw`\sqrt{#0}`,
  'cbrt()': String.raw`\sqrt[3]{#0}`,
  'root(,2)': String.raw`\sqrt[#?]{#0}`,
  'abs()': String.raw`\left|#0\right|`,
  'sin()': String.raw`\sin\left(#0\right)`,
  'cos()': String.raw`\cos\left(#0\right)`,
  'tan()': String.raw`\tan\left(#0\right)`,
  'cot()': String.raw`\cot\left(#0\right)`,
  'asin()': String.raw`\arcsin\left(#0\right)`,
  'acos()': String.raw`\arccos\left(#0\right)`,
  'atan()': String.raw`\arctan\left(#0\right)`,
  'log()': String.raw`\log\left(#0\right)`,
  'ln()': String.raw`\ln\left(#0\right)`,
  'log(,)': String.raw`\log_{#?}\left(#0\right)`,
  'nCr(,)': String.raw`\binom{#0}{#?}`,
  'nPr(,)': String.raw`\operatorname{nPr}\left(#0,#?\right)`,
  'gcd(,)': String.raw`\operatorname{gcd}\left(#0,#?\right)`,
  'lcm(,)': String.raw`\operatorname{lcm}\left(#0,#?\right)`,
  'mod(,)': String.raw`\operatorname{mod}\left(#0,#?\right)`,
  'mixed(,,)': String.raw`#0\,\frac{#?}{#?}`,
};

const symbols: Readonly<Record<string, string>> = {
  '*': String.raw`\times`,
  '×': String.raw`\times`,
  '%': String.raw`\%`,
  'π': String.raw`\pi`,
  'pi': String.raw`\pi`,
  'e': String.raw`\exponentialE`,
  '−': '-',
  '{': String.raw`\{`,
  '}': String.raw`\}`,
};

export function editorInsertion(insertion: Insertion): EditorInsertion {
  const { text } = insertion;
  const variable = /^var\(([a-z])\)$/.exec(text);
  if (variable) return { latex: variable[1] === 'e' ? String.raw`\mathit{e}` : variable[1], selectionMode: 'after' };
  const template = Object.hasOwn(templates, text) ? templates[text] : undefined;
  if (template) return { latex: template, selectionMode: 'placeholder' };

  const symbol = Object.hasOwn(symbols, text) ? symbols[text] : undefined;
  if (symbol) return { latex: symbol, selectionMode: 'after' };

  if (/^(?:\d+(?:\.\d*)?|\.\d*|[+\-!,()[\]])$/.test(text)) {
    return { latex: text, selectionMode: 'after' };
  }

  throw new MathError('Эта клавиша не поддерживается математическим редактором.');
}
