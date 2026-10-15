import type { HistoryEntry } from '../hooks/useHistory';
import { formatLatex, parse } from '../math';
import Icon from './Icon';
import MathView from './MathView';

function HistoryFormula({ expression, className }: { expression: string; className: string }) {
  try {
    return <MathView latex={formatLatex(parse(expression))} className={className} />;
  } catch {
    return <span className={`history-formula-text ${className}`}>{expression}</span>;
  }
}

function formattedTime(time: number): string {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return 'Время не сохранено';
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function History({ entries, onRestore, onClear, storageAvailable }: {
  entries: HistoryEntry[]; onRestore: (entry: HistoryEntry) => void; onClear: () => void; storageAvailable: boolean;
}) {
  return <section className="history-view" aria-label="История вычислений">
    <div className="history-view-heading">
      <div><h1>История</h1><span className="history-view-count">{entries.length}</span></div>
      <button type="button" className="history-clear" disabled={!entries.length} onClick={onClear}>Очистить</button>
    </div>
    <p className="history-description">Ваши вычисления. Нажмите на выражение, чтобы вернуться к нему.</p>
    {!storageAvailable && <p className="history-storage-notice" role="status">Браузер не разрешил сохранить историю. Она доступна до закрытия страницы.</p>}
    {entries.length ? <ol className="history-card-list">{entries.map(entry => <li key={entry.id}>
      <button type="button" className="history-card" onClick={() => onRestore(entry)} aria-label={`Вернуть в калькулятор: ${entry.expression}`}>
        <div className="history-card-meta"><span className="history-card-mode">{entry.angleMode}</span><time dateTime={Number.isNaN(new Date(entry.time).getTime()) ? undefined : new Date(entry.time).toISOString()}>{formattedTime(entry.time)}</time><Icon name="arrow" /></div>
        <HistoryFormula expression={entry.expression} className="history-card-expression" />
        {entry.variables && Object.keys(entry.variables).length > 0 && <p className="history-bindings">{Object.entries(entry.variables).map(([name, value]) => `${name} = ${value}`).join(' · ')}</p>}
        <div className="history-card-answer"><span aria-hidden="true">=</span><HistoryFormula expression={entry.result} className="history-card-result" /></div>
      </button>
    </li>)}</ol> : <div className="history-empty-state">
      <span className="history-empty-icon"><Icon name="history" /></span>
      <h2>Пока нет вычислений</h2>
      <p>Решите первое выражение — оно сохранится здесь вместе с ответом.</p>
    </div>}
    <p className="history-local-note">История сохраняется в этом браузере.</p>
  </section>;
}
