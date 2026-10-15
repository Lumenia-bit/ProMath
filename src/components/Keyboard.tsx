import { useId, useState, type ReactNode } from 'react';
import type { Insertion } from '../utils/editing';

type Category = 'basic' | 'scientific' | 'trigonometry' | 'logarithms' | 'other' | 'variables';
type KeyAction = 'solve' | 'negate' | 'clear' | 'backspace';
interface Key { label: ReactNode; title: string; insert?: Insertion; action?: KeyAction; style?: string }
interface KeyboardProps {
  onInsert: (insertion: Insertion) => void;
  onSolve: () => void;
  onNegate: () => void;
  onClear: () => void;
  onBackspace: () => void;
}

const textKey = (label: ReactNode, text: string, title: string, style?: string): Key => ({ label, title, insert: { text }, style });
const functionKey = (label: ReactNode, name: string, title: string): Key => textKey(label, `${name}()`, title);
const square = textKey(<>x<sup>2</sup></>, '^2', 'Возвести в квадрат');
const power = textKey(<>x<sup>y</sup></>, '^', 'Возвести в степень');
const root = functionKey('√x', 'sqrt', 'Квадратный корень');
const nthRoot = textKey(<><sup>n</sup>√</>, 'root(,2)', 'Корень произвольной степени');
const exponential = textKey(<>e<sup>x</sup></>, 'e^()', 'Возвести e в степень');
const reciprocal = functionKey('1/x', 'reciprocal', 'Обратное число');
const absolute = functionKey('|x|', 'abs', 'Модуль числа');
const factorial = textKey('!', '!', 'Факториал');
const pi = textKey('π', 'π', 'Число пи');
const euler = textKey('e', 'e', 'Число Эйлера');
const brackets = functionKey('( )', 'paren', 'Вставить скобки');
const fraction = textKey('a/b', 'frac(,)', 'Вставить дробь');
const negate: Key = { label: '±', action: 'negate', title: 'Изменить знак выделения или выражения' };

const categories: { id: Category; label: string; title: string }[] = [
  { id: 'basic', label: 'Осн', title: 'Основные функции' },
  { id: 'scientific', label: 'Науч', title: 'Научные функции' },
  { id: 'trigonometry', label: 'Триг', title: 'Тригонометрия' },
  { id: 'logarithms', label: 'log', title: 'Логарифмы' },
  { id: 'other', label: 'Ещё', title: 'Дроби, комбинаторика и теория чисел' },
  { id: 'variables', label: 'a–z', title: 'Неизвестные a–z' },
];

const functions: Record<Category, Key[]> = {
  variables: Array.from('abcdefghijklmnopqrstuvwxyz', letter => textKey(<i>{letter}</i>, `var(${letter})`, `Неизвестная ${letter}`)),
  basic: [
    functionKey('sin', 'sin', 'Синус'), functionKey('cos', 'cos', 'Косинус'), functionKey('tan', 'tan', 'Тангенс'),
    functionKey('ln', 'ln', 'Натуральный логарифм'), functionKey('log', 'log', 'Десятичный логарифм'),
    exponential, square, root, power, reciprocal,
    nthRoot, factorial, pi, euler, absolute,
  ],
  scientific: [
    square, power, root, nthRoot, functionKey('∛x', 'cbrt', 'Кубический корень'),
    exponential, reciprocal, fraction, absolute, factorial,
    pi, euler, negate, brackets, textKey('mod', 'mod(,)', 'Остаток от деления'),
  ],
  trigonometry: [
    functionKey('sin', 'sin', 'Синус'), functionKey('cos', 'cos', 'Косинус'), functionKey('tan', 'tan', 'Тангенс'),
    functionKey('cot', 'cot', 'Котангенс'), pi,
    functionKey('asin', 'asin', 'Арксинус'), functionKey('acos', 'acos', 'Арккосинус'), functionKey('atan', 'atan', 'Арктангенс'),
    brackets, negate,
  ],
  logarithms: [
    functionKey('log', 'log', 'Десятичный логарифм'), functionKey('ln', 'ln', 'Натуральный логарифм'),
    textKey(<>log<sub>x</sub></>, 'log(,)', 'Логарифм с произвольным основанием'), exponential, euler,
    textKey('10', '10', 'Число 10'), power, brackets, reciprocal, negate,
  ],
  other: [
    textKey('nCr', 'nCr(,)', 'Число сочетаний'), textKey('nPr', 'nPr(,)', 'Число размещений'),
    textKey('gcd', 'gcd(,)', 'Наибольший общий делитель'), textKey('lcm', 'lcm(,)', 'Наименьшее общее кратное'),
    textKey('mod', 'mod(,)', 'Остаток от деления'),
    fraction, textKey('Смеш.', 'mixed(,,)', 'Смешанное число'), factorial, absolute, negate,
  ],
};

const backspaceIcon = <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M9 5h11v14H9l-6-7 6-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  <path d="m12 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
</svg>;

const numericKeys: Key[] = [
  { label: 'AC', action: 'clear', title: 'Очистить выражение', style: 'utility-key clear-key' },
  { ...brackets, style: 'utility-key' }, textKey('%', '%', 'Процент', 'utility-key'), textKey('÷', '÷', 'Деление: вставить дробь', 'operator-key'),
  textKey('7', '7', '7'), textKey('8', '8', '8'), textKey('9', '9', '9'), textKey('×', '×', 'Умножение', 'operator-key'),
  textKey('4', '4', '4'), textKey('5', '5', '5'), textKey('6', '6', '6'), textKey('−', '-', 'Вычитание', 'operator-key'),
  textKey('1', '1', '1'), textKey('2', '2', '2'), textKey('3', '3', '3'), textKey('+', '+', 'Сложение', 'operator-key'),
  textKey('.', '.', 'Десятичная точка'), textKey('0', '0', '0'),
  { label: backspaceIcon, action: 'backspace', title: 'Удалить символ', style: 'utility-key' },
  { label: '=', action: 'solve', title: 'Решить выражение', style: 'equals-key' },
];

export default function Keyboard({ onInsert, onSolve, onNegate, onClear, onBackspace }: KeyboardProps) {
  const [category, setCategory] = useState<Category>('basic');
  const [expanded, setExpanded] = useState(true);
  const id = useId();
  const actions: Record<KeyAction, () => void> = { solve: onSolve, negate: onNegate, clear: onClear, backspace: onBackspace };

  function renderKey(key: Key, index: number, className: string) {
    return <button key={index} type="button" className={`${className} ${key.style ?? ''}`} title={key.title} aria-label={key.title}
      onMouseDown={event => event.preventDefault()} onClick={() => key.action ? actions[key.action]() : key.insert && onInsert(key.insert)}>
      {key.label}
    </button>;
  }

  return <section className="keyboard-section" aria-label="Математическая клавиатура">
    <div className="keyboard-toolbar">
      <div className="keyboard-tabs" role="tablist" aria-label="Категория математических функций">
        {categories.map((item, index) => <button key={item.id} type="button" id={`${id}-${item.id}`} role="tab"
          title={item.title} aria-selected={category === item.id} aria-controls={`${id}-functions`} tabIndex={category === item.id ? 0 : -1}
          onMouseDown={event => event.preventDefault()} onClick={() => { setCategory(item.id); setExpanded(true); }}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? categories.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : categories.length - 1)) % categories.length;
            setCategory(categories[nextIndex].id);
            setExpanded(true);
            document.getElementById(`${id}-${categories[nextIndex].id}`)?.focus();
          }}>{item.label}</button>)}
      </div>
      <button className="keyboard-collapse" type="button" aria-label={expanded ? 'Скрыть функции' : 'Показать функции'}
        aria-expanded={expanded} aria-controls={`${id}-functions`} onMouseDown={event => event.preventDefault()}
        onClick={() => setExpanded(value => !value)}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d={expanded ? 'm6 8 4-4 4 4M6 12l4 4 4-4' : 'm6 12 4-4 4 4'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
    <div id={`${id}-functions`} role="tabpanel" aria-labelledby={`${id}-${category}`} className="scientific-drawer" hidden={!expanded}>
      <div className={`scientific-grid${category === 'variables' ? ' alphabet-grid' : ''}`}>{functions[category].map((key, index) => renderKey(key, index, 'scientific-key'))}</div>
    </div>
    <div className="numeric-grid" aria-label="Цифры и операции">{numericKeys.map((key, index) => renderKey(key, index, 'numeric-key'))}</div>
  </section>;
}
