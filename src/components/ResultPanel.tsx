import { useEffect, useId, useRef, useState } from 'react';
import type { Solution } from '../math/types';
import MathView from './MathView';
import Icon from './Icon';

function stepCount(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  const word = lastTwo >= 11 && lastTwo <= 14 ? 'шагов' : last === 1 ? 'шаг' : last >= 2 && last <= 4 ? 'шага' : 'шагов';
  return `${count} ${word}`;
}

function SolutionContent({ solution }: { solution: Solution }) {
  const [format, setFormat] = useState<'exact' | 'approx'>('exact');
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());
  const timeout = useRef<number | undefined>(undefined);
  const id = useId();
  const allExpanded = collapsed.size === 0;

  useEffect(() => () => window.clearTimeout(timeout.current), []);

  function selectFormat(next: 'exact' | 'approx') {
    setFormat(next);
    setCopied(false);
    setCopyFailed(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(format === 'exact' ? solution.exact : solution.approximate);
      setCopied(true);
      setCopyFailed(false);
      window.clearTimeout(timeout.current);
      timeout.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyFailed(true);
    }
  }

  function toggleStep(index: number) {
    setCollapsed(previous => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return <>
    <div className="solution-original">
      <div className="solution-original-heading">
        <h2>Исходное выражение</h2>
        <span className="solution-angle-mode">{solution.angleMode}</span>
      </div>
      <MathView latex={solution.expressionLatex} className="solution-original-formula" />
    </div>
    <div className="solution-answer">
      <div className="solution-answer-heading">
        <span className="solution-answer-label"><span aria-hidden="true" />Финальный результат</span>
        <div className="solution-format-switch" role="group" aria-label="Формат ответа">
          <button type="button" aria-pressed={format === 'exact'} onClick={() => selectFormat('exact')}>Точно</button>
          {!!solution.approximate && <button type="button" aria-label="Приблизительный ответ" aria-pressed={format === 'approx'} onClick={() => selectFormat('approx')}>≈ Числом</button>}
        </div>
      </div>
      <div className="solution-answer-row">
        <span className="solution-answer-prefix">Ответ:</span>
        <MathView latex={format === 'exact' ? solution.latex : solution.approximateLatex} className="solution-answer-formula" />
        <button type="button" className="solution-copy" onClick={copy} aria-label={copied ? 'Ответ скопирован' : 'Копировать ответ'} title={copied ? 'Скопировано' : 'Копировать ответ'}>
          <Icon name={copied ? 'check' : 'copy'} />
        </button>
      </div>
      {format === 'exact' && !!solution.approximate && solution.exact !== solution.approximate && <div className="solution-approximation">≈ <MathView latex={solution.approximateLatex} /></div>}
      <span className="solution-copy-status" role="status">{copied ? 'Ответ скопирован' : copyFailed ? 'Копирование недоступно. Ответ можно выделить вручную.' : ''}</span>
    </div>
    {!!solution.unresolvedVariables?.length && <p className="solution-variable-note">Чтобы получить числовой ответ, задайте значения: {solution.unresolvedVariables.join(', ')}.</p>}
    {!!solution.conditions?.length && <div className="solution-variable-note"><strong>Условия определения</strong>{solution.conditions.map(condition => <p key={condition}>{condition}</p>)}</div>}
    <div className="solution-steps-heading">
      <div><h2>Пошаговое решение</h2><span className="solution-step-count">{stepCount(solution.steps.length)}</span></div>
      <button type="button" className="solution-expand-all" onClick={() => setCollapsed(allExpanded ? new Set(solution.steps.map((_, index) => index)) : new Set())} aria-label={allExpanded ? 'Свернуть все шаги' : 'Развернуть все шаги'}>
        <Icon name="chevron" style={{ transform: allExpanded ? 'rotate(180deg)' : undefined }} />
        <span>{allExpanded ? 'Свернуть всё' : 'Развернуть всё'}</span>
      </button>
    </div>
    <ol className="solution-step-list">
      {solution.steps.map((step, index) => {
        const expanded = !collapsed.has(index);
        const showAfter = step.type !== 'result' && step.afterLatex && step.afterLatex !== step.operationLatex && step.afterLatex !== step.beforeLatex;
        const headingId = `${id}-step-heading-${index}`;
        const contentId = `${id}-step-content-${index}`;
        return <li className="solution-step-card" key={index}>
          <button type="button" className="solution-step-toggle" aria-expanded={expanded} aria-controls={contentId} id={headingId} onClick={() => toggleStep(index)}>
            <span className="solution-step-number">{index + 1}</span>
            <span className="solution-step-explanation">{step.explanation}</span>
            <Icon name="chevron" style={{ transform: expanded ? undefined : 'rotate(-90deg)' }} />
          </button>
          <div className="solution-step-body" id={contentId} role="region" aria-labelledby={headingId} hidden={!expanded}>
            <MathView latex={step.operationLatex} className="solution-step-formula" />
            {showAfter && <><p className="solution-step-after-label">Выражение после шага</p><MathView latex={step.afterLatex} className="solution-step-formula solution-step-after" /></>}
          </div>
        </li>;
      })}
    </ol>
  </>;
}

export default function ResultPanel({ solution, stale }: { solution: Solution | null; stale: boolean }) {
  return <section className={`solution-panel${stale ? ' solution-stale' : ''}`} aria-label="Ответ и решение">
    {solution ? <>
      {stale && <p className="solution-stale-notice" role="status">Выражение или значения неизвестных изменены. Решите снова, чтобы обновить ответ.</p>}
      <SolutionContent solution={solution} key={`${solution.expressionLatex}|${solution.angleMode}|${solution.exact}|${solution.approximate}`} />
    </> : <div className="solution-empty">
      <Icon name="info" />
      <h2>Здесь появится решение</h2>
      <p>Введите выражение и нажмите =, чтобы увидеть ответ и шаги вычисления.</p>
    </div>}
  </section>;
}
