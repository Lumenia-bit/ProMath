interface VariableInputsProps {
  names: string[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  onReset: () => void;
  onSolve: () => void;
}

export default function VariableInputs({ names, values, onChange, onReset, onSolve }: VariableInputsProps) {
  if (!names.length) return null;
  return <section className="variable-inputs" aria-label="Значения неизвестных">
    <div className="variable-heading"><h2>Неизвестные</h2><button type="button" onClick={onReset} disabled={!names.some(name => values[name]?.trim())}>Сбросить значения</button></div>
    <p>Оставьте пустым для буквенного ответа или задайте число, дробь, выражение.</p>
    <div className="variable-grid">{names.map(name => <label className="variable-field" key={name}>
      <span><i>{name}</i> =</span>
      <input type="text" value={values[name] ?? ''} maxLength={2000} placeholder="Не задано" aria-label={`Значение ${name}`}
        autoComplete="off" spellCheck={false} onChange={event => onChange(name, event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onSolve(); } }} />
    </label>)}</div>
  </section>;
}
