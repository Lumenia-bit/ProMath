export type VariableBindings = Record<string, string>;

export function selectBindings(names: readonly string[], values: VariableBindings): VariableBindings {
  return Object.fromEntries(names.filter(name => values[name]?.trim()).map(name => [name, values[name].trim()]));
}

export function bindingKey(values: VariableBindings): string {
  return JSON.stringify(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)));
}

export function isVariableBindings(value: unknown): value is VariableBindings {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.entries(value).every(([name, expression]) => /^[a-z]$/.test(name)
      && typeof expression === 'string' && expression.length <= 2000);
}
