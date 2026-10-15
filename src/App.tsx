import { useMemo, useRef, useState } from 'react';
import { parse, solve } from './math';
import { collectVariables } from './math/variables';
import type { AngleMode, Solution } from './math/types';
import { MathError } from './math/errors';
import { useSettings } from './hooks/useSettings';
import { useHistory, type HistoryEntry } from './hooks/useHistory';
import MathInput, { type MathInputHandle } from './components/MathInput';
import MathView from './components/MathView';
import Icon from './components/Icon';
import Keyboard from './components/Keyboard';
import ResultPanel from './components/ResultPanel';
import History from './components/History';
import Help from './components/Help';
import VariableInputs from './components/VariableInputs';
import { bindingKey, selectBindings, type VariableBindings } from './utils/bindings';

type View = 'calculator' | 'solution' | 'history';
const views: { id: View; label: string; icon: 'calculator' | 'book' | 'history' }[] = [
  { id: 'calculator', label: 'Калькулятор', icon: 'calculator' },
  { id: 'solution', label: 'Решение', icon: 'book' },
  { id: 'history', label: 'История', icon: 'history' },
];

export default function App() {
  const { theme, setTheme, angleMode, setAngleMode } = useSettings();
  const { history, add, clear, storageAvailable } = useHistory();
  const [expression, setExpression] = useState('');
  const [solution, setSolution] = useState<Solution | null>(null);
  const [solvedExpression, setSolvedExpression] = useState('');
  const [bindings, setBindings] = useState<VariableBindings>({});
  const [solvedBindings, setSolvedBindings] = useState(bindingKey({}));
  const [error, setError] = useState<MathError | null>(null);
  const [activeView, setActiveView] = useState<View>('calculator');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [format, setFormat] = useState<'exact' | 'approx'>('approx');
  const [copied, setCopied] = useState(false);
  const input = useRef<MathInputHandle>(null);
  const variableNames = useMemo(() => { try { return collectVariables(parse(expression)); } catch { return []; } }, [expression]);
  const currentBindings = selectBindings(variableNames, bindings);
  const stale = !!solution && (solvedExpression !== expression || solution.angleMode !== angleMode || solvedBindings !== bindingKey(currentBindings));
  const showExact = format === 'exact' || (!!solution && !stale && !solution.approximate);

  function calculate(value?: string, mode: AngleMode = angleMode, save = true, values: VariableBindings = bindings): Solution | undefined {
    try {
      const current = value ?? input.current?.getExpression() ?? expression;
      if (!current.trim()) throw new MathError('Введите число или математическое выражение.');
      const usedBindings = selectBindings(collectVariables(parse(current)), values);
      const next = solve(current, { angleMode: mode, variables: usedBindings });
      setExpression(current); setSolution(next); setSolvedExpression(current); setSolvedBindings(bindingKey(usedBindings)); setError(null);
      if (save) add({ expression: current, result: next.exact, angleMode: mode, variables: usedBindings });
      return next;
    } catch (cause) {
      setError(cause instanceof MathError ? cause : new MathError('Не удалось вычислить выражение. Проверьте ввод.'));
      input.current?.focus();
      return undefined;
    }
  }
  function showSolution() {
    if (calculate(undefined, angleMode, !solution || stale)) setActiveView('solution');
  }
  function changeMode(mode: AngleMode) {
    setAngleMode(mode);
    if (expression.trim()) calculate(undefined, mode, false);
  }
  function restore(entry: HistoryEntry) {
    setAngleMode(entry.angleMode);
    const restoredBindings = entry.variables ?? {};
    setBindings(restoredBindings);
    input.current?.setExpression(entry.expression);
    calculate(entry.expression, entry.angleMode, false, restoredBindings);
    setActiveView('calculator');
  }
  async function copyExpression() {
    try {
      const current = input.current?.getExpression() ?? expression;
      await navigator.clipboard.writeText(current);
      setCopied(true); window.setTimeout(() => setCopied(false), 1500);
    } catch (cause) {
      setError(cause instanceof MathError ? cause : new MathError('Браузер не разрешил копирование.'));
    }
  }
  function navigate(view: View) {
    setSettingsVisible(false);
    if (view === 'solution' && expression.trim() && (!solution || stale)) { showSolution(); return; }
    setActiveView(view);
  }

  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href={import.meta.env.BASE_URL} aria-label="ProMath — калькулятор">
        <svg className="brand-logo" viewBox="0 0 44 44" aria-hidden="true"><rect width="44" height="44" rx="10" /><path d="m9 23 5 7 8-17h12" /><circle cx="33" cy="25" r="2" /></svg>
        <span className="brand-text"><span className="brand-title">ProMath <span className="brand-version">1.0</span></span><span className="brand-subtitle">{activeView === 'calculator' ? 'Calculator' : activeView === 'solution' ? 'Solution Steps' : 'History'}</span></span>
      </a>
      <div className="header-actions">
        <button className="icon-button" onClick={() => navigate('history')} aria-label="История вычислений"><Icon name="history" /></button>
        <button className={`icon-button ${settingsVisible ? 'active' : ''}`} onClick={() => setSettingsVisible(!settingsVisible)} aria-label="Настройки" aria-expanded={settingsVisible}><Icon name="settings" /></button>
        <button className="icon-button header-help" onClick={() => setHelpVisible(!helpVisible)} aria-label="Справка" aria-expanded={helpVisible}><Icon name="info" /></button>
      </div>
      {settingsVisible && <section className="settings-panel" aria-label="Настройки калькулятора">
        <div className="settings-heading"><h2>Настройки</h2><button className="icon-button" aria-label="Закрыть настройки" onClick={() => setSettingsVisible(false)}><Icon name="close" /></button></div>
        <p>Оформление</p><div className="settings-options">
          <button aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Icon name="sun" />Светлое</button>
          <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Icon name="moon" />Тёмное</button>
        </div><p className="settings-note">История сохраняется на этом устройстве.</p>
      </section>}
    </header>
    <main>
      <h1 className="sr-only">Научный калькулятор ProMath</h1>
      {helpVisible && <Help onClose={() => setHelpVisible(false)} />}
      <div className="workspace" hidden={activeView !== 'calculator'}>
        <div className="calculator-panel">
          <div className="calculator-toolbar">
            <span className="core-chip"><span className="status-dot" />НАУЧНЫЙ</span>
            <div className="angle-switch" aria-label="Единицы углов">{(['RAD', 'DEG'] as const).map(mode => <button key={mode} aria-pressed={angleMode === mode} onClick={() => changeMode(mode)}>{mode}</button>)}</div>
            <button className="format-chip" disabled={!!solution && !stale && !solution.approximate} onClick={() => setFormat(format === 'exact' ? 'approx' : 'exact')} aria-label="Переключить точный и десятичный ответ">{showExact ? 'Точно' : '≈ Число'}</button>
            <button className="fraction-shortcut" onMouseDown={event => event.preventDefault()} onClick={() => input.current?.insert({ text: 'frac(,)' })} aria-label="Вставить дробь">a/b</button>
          </div>
          <section className={`input-panel expression-box ${error ? 'has-error' : ''}`} aria-label="Ввод выражения">
            <div className="display-heading"><label className="input-label" htmlFor="expression"><Icon name="calculator" />Выражение</label><button className="icon-button" onClick={copyExpression} aria-label="Копировать выражение"><Icon name={copied ? 'check' : 'copy'} /></button></div>
            <MathInput ref={input} initialExpression="" invalid={!!error} onEdit={value => { setExpression(value); setError(null); }} onSolve={() => calculate()} onError={setError} />
            <div className="input-tools"><span id="input-hint" className="editor-hint">Tab — следующая ячейка</span><button className="icon-button cell-next" onMouseDown={event => event.preventDefault()} onClick={() => input.current?.nextCell()} aria-label="Следующая ячейка" title="Следующая ячейка (Tab)">↹</button></div>
            <VariableInputs names={variableNames} values={bindings}
              onChange={(name, value) => { setBindings(previous => ({ ...previous, [name]: value })); setError(null); }}
              onReset={() => { setBindings(previous => Object.fromEntries(Object.entries(previous).filter(([name]) => !variableNames.includes(name)))); setError(null); }}
              onSolve={() => calculate()} />
            {error && <div id="expression-error" className="error-message" role="alert"><Icon name="info" /><span>{error.message}</span></div>}
            <div className="calculator-answer" aria-live="polite">{solution && !stale ? <>
              <span className="answer-equals">=</span><MathView latex={showExact ? solution.latex : solution.approximateLatex} className="calculator-answer-value" />
              {!!solution.approximate && solution.exact !== solution.approximate && <MathView latex={showExact ? `\\approx ${solution.approximateLatex}` : `\\left(${solution.latex}\\right)`} className="calculator-answer-alternative" />}
            </> : <span className="pending-answer">Нажмите = для вычисления</span>}</div>
            <button className="calculate-button" onClick={showSolution}><Icon name="book" /><span>Решить пошагово</span><Icon name="arrow" /></button>
          </section>
          <div className="keyboard-area"><Keyboard onInsert={insertion => input.current?.insert(insertion)} onSolve={() => calculate()} onNegate={() => input.current?.negate()} onClear={() => input.current?.clear()} onBackspace={() => input.current?.backspace()} /></div>
          {solution && !stale && <button className="solution-summary" onClick={() => setActiveView('solution')}><span className="summary-count">{solution.steps.length}</span><span><strong>Шаги решения готовы</strong><small>{solution.steps[0]?.explanation}</small></span><Icon name="arrow" /></button>}
        </div>
        <aside className="desktop-solution"><ResultPanel solution={solution} stale={stale} /></aside>
      </div>
      {activeView === 'solution' && <div className="solution-page"><button className="back-button" onClick={() => setActiveView('calculator')}><Icon name="arrow" />Калькулятор</button><ResultPanel solution={solution} stale={stale} /></div>}
      {activeView === 'history' && <div className="history-page"><button className="back-button" onClick={() => setActiveView('calculator')}><Icon name="arrow" />Калькулятор</button><History entries={history} onRestore={restore} onClear={clear} storageAvailable={storageAvailable} /></div>}
    </main>
    <nav className="bottom-nav" aria-label="Разделы калькулятора">{views.map(view => <button key={view.id} aria-current={activeView === view.id ? 'page' : undefined} onClick={() => navigate(view.id)}><Icon name={view.icon} /><span>{view.label}</span></button>)}</nav>
  </div>;
}
