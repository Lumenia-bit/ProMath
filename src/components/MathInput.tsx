import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { MathfieldElement } from 'mathlive';
import 'mathlive/fonts.css';
import { expressionToLatex, latexToExpression } from '../editor/latex';
import { editorInsertion } from '../editor/templates';
import { clipboardToLatex } from '../editor/clipboard';
import { MathError } from '../math/errors';
import { LIMITS } from '../math/limits';
import type { Insertion } from '../utils/editing';

MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;

export interface MathInputHandle {
  insert: (insertion: Insertion) => void;
  backspace: () => void;
  clear: () => void;
  negate: () => void;
  nextCell: () => void;
  getExpression: () => string;
  setExpression: (expression: string) => void;
  focus: () => void;
}
interface Props {
  initialExpression: string;
  invalid: boolean;
  onEdit: (expression: string) => void;
  onSolve: () => void;
  onError: (error: MathError) => void;
}

const LATEX_LIMIT = 5000;
function checkEditorSize(latex: string) {
  if (latex.length > LATEX_LIMIT) throw new MathError('Формула слишком длинная. Разбейте её на несколько выражений.');
  let depth = 0;
  for (const character of latex) {
    if (character === '{' && ++depth > LIMITS.depth) throw new MathError('Слишком много вложенных ячеек.');
    if (character === '}') depth--;
  }
}

const MathInput = forwardRef<MathInputHandle, Props>(function MathInput(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<MathfieldElement | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;

  function reportChange() {
    const latex = field.current?.value ?? '';
    field.current?.setAttribute('data-editor-latex', latex);
    if (!latex) { callbacks.current.onEdit(''); return; }
    try { callbacks.current.onEdit(latexToExpression(latex)); }
    catch { callbacks.current.onEdit(latex); }
  }
  function change(action: (element: MathfieldElement) => void) {
    const element = field.current;
    if (!element) return;
    try {
      action(element);
      element.focus();
      reportChange();
    } catch (cause) {
      callbacks.current.onError(cause instanceof MathError ? cause : new MathError('Не удалось изменить формулу.'));
    }
  }

  useImperativeHandle(ref, () => ({
    insert: insertion => change(element => {
      const template = editorInsertion(insertion);
      checkEditorSize(element.value + template.latex);
      element.insert(template.latex, { format: 'latex', insertionMode: 'replaceSelection', selectionMode: template.selectionMode });
    }),
    backspace: () => change(element => { element.executeCommand('deleteBackward'); }),
    clear: () => change(element => { element.setValue('', { silenceNotifications: true }); }),
    negate: () => change(element => {
      checkEditorSize(element.value + String.raw`-\left(\right)`);
      if (element.selectionIsCollapsed) element.executeCommand('selectAll');
      element.insert(String.raw`-\left(#0\right)`, { format: 'latex', selectionMode: 'after' });
    }),
    nextCell: () => change(element => {
      const position = element.position;
      element.executeCommand('moveToNextPlaceholder');
      if (element.position === position) element.executeCommand('moveAfterParent');
    }),
    getExpression: () => {
      const latex = field.current?.value ?? '';
      if (!latex.trim()) return '';
      return latexToExpression(latex);
    },
    setExpression: expression => change(element => {
      const latex = expressionToLatex(expression);
      checkEditorSize(latex);
      element.setValue(latex, { silenceNotifications: true });
      element.executeCommand('moveToMathfieldEnd');
    }),
    focus: () => { field.current?.focus(); },
  }));

  useLayoutEffect(() => {
    const element = new MathfieldElement();
    element.id = 'expression';
    element.setAttribute('aria-label', 'Выражение');
    element.setAttribute('aria-describedby', 'input-hint');
    element.setAttribute('role', 'textbox');
    element.setAttribute('placeholder', String.raw`\text{Введите выражение}`);
    const mounted = () => {
      element.mathVirtualKeyboardPolicy = 'manual';
      element.menuItems = [];
      element.popoverPolicy = 'off';
      element.smartMode = false;
      element.smartFence = true;
      element.smartSuperscript = false;
      element.scriptDepth = 20;
      element.inlineShortcuts = {
        pi: String.raw`\pi`, sqrt: String.raw`\sqrt{#?}`, cbrt: String.raw`\sqrt[3]{#?}`,
        sin: String.raw`\sin`, cos: String.raw`\cos`, tan: String.raw`\tan`, cot: String.raw`\cot`,
        asin: String.raw`\arcsin`, acos: String.raw`\arccos`, atan: String.raw`\arctan`,
        log: String.raw`\log`, ln: String.raw`\ln`, abs: String.raw`\left|#?\right|`,
        gcd: String.raw`\operatorname{gcd}`, lcm: String.raw`\operatorname{lcm}`,
        nCr: String.raw`\operatorname{nCr}`, nPr: String.raw`\operatorname{nPr}`,
        root: String.raw`\operatorname{root}`, mixed: String.raw`\operatorname{mixed}`,
        mod: String.raw`\operatorname{mod}`, frac: String.raw`\operatorname{frac}`,
      };
      const initial = callbacks.current.initialExpression.trim();
      element.setValue(initial ? expressionToLatex(initial) : '', { silenceNotifications: true });
      element.setAttribute('data-editor-latex', element.value);
    };
    element.addEventListener('mount', mounted);
    field.current = element;
    host.current?.append(element);

    const input = () => reportChange();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); callbacks.current.onSolve(); }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); change(mf => mf.setValue('', { silenceNotifications: true })); }
    };
    const beforeInput = (event: InputEvent) => {
      if (!event.inputType?.startsWith('insert')) return;
      try { checkEditorSize(element.value + ' '); }
      catch (cause) { event.preventDefault(); callbacks.current.onError(cause as MathError); }
    };
    const paste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain');
      if (!text) return;
      event.preventDefault(); event.stopPropagation();
      try {
        const latex = clipboardToLatex(text);
        change(mf => {
          checkEditorSize(mf.value + latex);
          mf.insert(latex, { format: 'latex', selectionMode: 'after' });
        });
      } catch (cause) {
        callbacks.current.onError(cause instanceof MathError ? cause : new MathError('Не удалось вставить выражение.'));
      }
    };
    element.addEventListener('input', input);
    element.addEventListener('keydown', keydown, true);
    element.addEventListener('beforeinput', beforeInput as EventListener);
    element.addEventListener('paste', paste, true);
    return () => {
      element.removeEventListener('input', input);
      element.removeEventListener('keydown', keydown, true);
      element.removeEventListener('beforeinput', beforeInput as EventListener);
      element.removeEventListener('paste', paste, true);
      element.removeEventListener('mount', mounted);
      element.remove();
      field.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    field.current?.setAttribute('aria-invalid', String(props.invalid));
    field.current?.setAttribute('aria-describedby', props.invalid ? 'expression-error' : 'input-hint');
  }, [props.invalid]);

  return <div className="math-input" ref={host} />;
});

export default MathInput;
