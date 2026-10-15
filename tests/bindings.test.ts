import { describe, expect, it } from 'vitest';
import { bindingKey, isVariableBindings, selectBindings } from '../src/utils/bindings';

describe('variable bindings for calculation and history', () => {
  it('selects only referenced letters with nonempty, trimmed values', () => {
    const values = { a: ' 1/2 ', b: ' ', c: '', d: ' 1.2e-5 ', z: '99' };
    expect(selectBindings(['a', 'b', 'c', 'd', 'x'], values)).toEqual({ a: '1/2', d: '1.2e-5' });
    expect(values).toEqual({ a: ' 1/2 ', b: ' ', c: '', d: ' 1.2e-5 ', z: '99' });
  });

  it('retains zero, negative values and closed mathematical expressions', () => {
    expect(selectBindings(['a', 'b', 'c', 'e'], { a: '0', b: '-3', c: 'sqrt(4)', e: '2' })).toEqual({ a: '0', b: '-3', c: 'sqrt(4)', e: '2' });
    expect(selectBindings([], { x: '1' })).toEqual({});
  });

  it('uses a stable calculation key regardless of assignment order', () => {
    expect(bindingKey({ z: '3', a: '1/2', e: '7' })).toBe(bindingKey({ e: '7', z: '3', a: '1/2' }));
    expect(bindingKey({ a: '1/2', b: '3' })).not.toBe(bindingKey({ a: '1/2', b: '4' }));
    expect(bindingKey({ a: '1/2' })).not.toBe(bindingKey({ b: '1/2' }));
  });

  it('ignores unreferenced assignments when identifying the active calculation', () => {
    const first = selectBindings(['x'], { x: ' 2 ', y: '3' });
    const second = selectBindings(['x'], { x: '2', y: '4', z: '5' });
    expect(bindingKey(first)).toBe(bindingKey(second));
  });

  it.each([{}, { x: '2' }, { a: '1/2', e: 'sqrt(4)', z: '' }])('accepts stored string assignments %j', value => {
    expect(isVariableBindings(value)).toBe(true);
  });

  const invalidStoredValues: unknown[] = [null, undefined, [], ['2'], 2, '2', true, { x: 2 }, { x: null }, { x: [] }, { x: {} }, { X: '2' }, { pi: '2' }, { ab: '2' }, { '': '2' }, { '1': '2' }, { constructor: '2' }, { prototype: '2' }];
  it.each(invalidStoredValues.map(value => ({ value })))('rejects malformed stored assignments $value', ({ value }) => {
    expect(isVariableBindings(value)).toBe(false);
  });

  it('rejects an own prototype-related key after JSON history loading', () => {
    expect(isVariableBindings(JSON.parse('{"__proto__":"2"}'))).toBe(false);
  });

  it('bounds stored expressions without rejecting supported short mathematical text', () => {
    expect(isVariableBindings({ x: '1'.repeat(2000) })).toBe(true);
    expect(isVariableBindings({ x: '1'.repeat(2001) })).toBe(false);
    expect(isVariableBindings({ x: '1/0' })).toBe(true);
  });
});
