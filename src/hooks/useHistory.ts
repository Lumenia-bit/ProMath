import { useState } from 'react';
import type { AngleMode } from '../math/types';
import { readStorage, writeStorage } from '../utils/storage';
import { bindingKey, isVariableBindings, type VariableBindings } from '../utils/bindings';

export interface HistoryEntry { id: string; expression: string; result: string; time: number; angleMode: AngleMode; variables?: VariableBindings }
const KEY = 'promath.history.v1';

function loadHistory(): HistoryEntry[] {
  const stored = readStorage(KEY);
  if (!Array.isArray(stored)) return [];
  return stored.filter((entry): entry is HistoryEntry => entry && typeof entry.id === 'string'
    && typeof entry.expression === 'string' && entry.expression.length <= 2000
    && typeof entry.result === 'string' && entry.result.length <= 12000
    && typeof entry.time === 'number' && Number.isFinite(entry.time)
    && (entry.angleMode === 'DEG' || entry.angleMode === 'RAD')
    && (entry.variables === undefined || isVariableBindings(entry.variables))).slice(0, 50);
}

export function useHistory() {
  const [history, setHistory] = useState(loadHistory);
  const [storageAvailable, setStorageAvailable] = useState(true);
  function add(entry: Omit<HistoryEntry, 'id' | 'time'>) {
    const next = [{ ...entry, id: crypto.randomUUID(), time: Date.now() },
      ...history.filter(item => item.expression !== entry.expression || item.angleMode !== entry.angleMode
        || bindingKey(item.variables ?? {}) !== bindingKey(entry.variables ?? {}))].slice(0, 50);
    setHistory(next);
    setStorageAvailable(writeStorage(KEY, next));
  }
  function clear() { setHistory([]); setStorageAvailable(writeStorage(KEY, [])); }
  return { history, add, clear, storageAvailable };
}
