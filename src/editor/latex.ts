import { type ASTNode, type BinaryOperator } from '../math/ast';
import { MathError } from '../math/errors';
import { formatAST } from '../math/format';
import { LIMITS } from '../math/limits';
import { parse } from '../math/parser';
import { editorLatex } from './latex-format';
import { tokenizeLatex, type LatexToken } from './latex-tokens';

const closes: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const startsAtom = (token: LatexToken) => ['number', 'constant', 'variable', 'function', 'fraction', 'root', 'binomial', 'open', 'bar'].includes(token.kind);

class LatexParser {
  private cursor = 0;
  private depth = 0;
  private nodes = 0;
  private bars = 0;
  constructor(private readonly tokens: LatexToken[]) {}

  parse(): ASTNode {
    if (this.peek().kind === 'eof') throw new MathError('Введите математическое выражение.');
    const node = this.expression();
    if (this.peek().kind !== 'eof') throw new MathError('Проверьте скобки и математические знаки в выражении.', this.peek().start);
    return node;
  }
  private peek() { return this.tokens[Math.min(this.cursor, this.tokens.length - 1)]; }
  private take() { return this.tokens[this.cursor++]; }
  private isOperator(value: string) { return this.peek().kind === 'operator' && this.peek().value === value; }
  private node<T extends ASTNode>(node: T): T {
    if (++this.nodes > LIMITS.nodes) throw new MathError('Выражение содержит слишком много операций.', node.start);
    return node;
  }
  private nested<T>(read: () => T): T {
    if (++this.depth > LIMITS.depth) throw new MathError('Слишком много вложенных ячеек, скобок или степеней.', this.peek().start);
    try { return read(); } finally { this.depth--; }
  }
  private binary(operator: BinaryOperator, left: ASTNode, right: ASTNode): ASTNode {
    return this.node({ type: 'binary', operator, left, right, start: left.start, end: right.end });
  }
  private call(name: string, args: ASTNode[], token: LatexToken): ASTNode {
    if (name === 'var') {
      const argument = args[0];
      if (args.length !== 1 || !argument || !((argument.type === 'variable' || argument.type === 'constant') && /^[a-z]$/.test(argument.name))) {
        throw new MathError('Для переменной укажите одну букву от a до z: например var(e).', token.start);
      }
      return this.node({ type: 'variable', name: argument.name, start: token.start, end: argument.end });
    }
    return this.node({ type: 'function', name, args, start: token.start, end: args.at(-1)?.end ?? token.end });
  }
  private expression(): ASTNode {
    return this.nested(() => {
      let left = this.product();
      while (this.isOperator('+') || this.isOperator('-')) {
        const operator = this.take();
        left = this.binary(operator.value as BinaryOperator, left, this.product());
      }
      return left;
    });
  }
  private product(): ASTNode {
    let left = this.unary();
    while (true) {
      if (this.isOperator('*') || this.isOperator('/') || this.isOperator('%')) {
        const operator = this.take();
        left = this.binary(operator.value as BinaryOperator, left, this.unary());
      } else if (startsAtom(this.peek()) && (this.peek().kind !== 'bar' || this.peek().value === 'open' || (this.bars === 0 && this.peek().value === '|'))) {
        const next = this.peek();
        if (this.tokens[this.cursor - 1]?.kind === 'number' && next.kind === 'number' && !next.argumentTail) throw new MathError('Между числами нужен оператор.', next.start);
        left = this.binary('*', left, this.unary());
      } else break;
    }
    return left;
  }
  private unary(): ASTNode {
    if (this.isOperator('+') || this.isOperator('-')) {
      const token = this.take();
      const argument = this.nested(() => this.unary());
      return this.node({ type: 'unary', operator: token.value as '+' | '-', argument, start: token.start, end: argument.end });
    }
    return this.postfix();
  }
  private postfix(): ASTNode {
    let argument = this.primary();
    while (true) {
      if (this.isOperator('!') || this.isOperator('percentage')) {
        const token = this.take();
        argument = this.node({ type: token.value === '!' ? 'factorial' : 'percentage', argument, start: argument.start, end: token.end });
      } else if (this.isOperator('^')) {
        this.take();
        const exponent = this.script('показатель степени');
        argument = this.binary('^', argument, exponent);
      } else break;
    }
    return argument;
  }
  private script(label: string): ASTNode {
    if (this.peek().kind === 'open' && this.peek().value === '{') return this.group(label);
    return this.nested(() => {
      if (this.isOperator('+') || this.isOperator('-')) {
        const token = this.take();
        const argument = this.singleAtom(label);
        return this.node({ type: 'unary', operator: token.value as '+' | '-', argument, start: token.start, end: argument.end });
      }
      return this.singleAtom(label);
    });
  }
  private singleAtom(label: string): ASTNode {
    const token = this.peek();
    if (token.kind === 'open' && token.value === '{') return this.group(label);
    if (token.kind === 'number') {
      if (!/\d/.test(token.value[0])) throw new MathError(`Для десятичного числа заполните ${label} внутри фигурных скобок.`, token.start);
      this.take();
      const remainder = token.value.slice(1);
      if (remainder) {
        const tail = tokenizeLatex(remainder).filter(part => part.kind !== 'eof').map(part => ({ ...part, argumentTail: true, start: part.start + token.start + 1, end: part.end + token.start + 1 }));
        this.tokens.splice(this.cursor, 0, ...tail);
        if (this.tokens.length > LIMITS.tokens + 1) throw new MathError('Слишком много элементов в выражении.', token.start);
      }
      return this.node({ type: 'number', value: token.value[0], start: token.start, end: token.start + 1 });
    }
    if (token.kind === 'eof' || token.kind === 'close' || token.kind === 'operator') throw new MathError(`Заполните ${label}.`, token.start);
    return this.nested(() => this.primary(false));
  }
  private group(label = 'ячейку выражения'): ASTNode {
    const opening = this.take();
    if (opening.kind !== 'open') throw new MathError(`Заполните ${label}.`, opening.start);
    if (this.peek().kind === 'close' || this.peek().kind === 'eof') throw new MathError(`Заполните ${label}.`, this.peek().start);
    const argument = this.expression();
    this.close(opening);
    return argument;
  }
  private close(opening: LatexToken) {
    const token = this.take();
    if (token.kind !== 'close' || token.value !== closes[opening.value]) throw new MathError(`Не закрыта скобка «${opening.value}».`, opening.start);
  }
  private fraction(token: LatexToken): ASTNode {
    const numerator = this.singleAtom('числитель дроби');
    const denominator = this.singleAtom('знаменатель дроби');
    return this.node({ type: 'binary', operator: '/', left: numerator, right: denominator, start: token.start, end: denominator.end });
  }
  private function(token: LatexToken): ASTNode {
    let base: ASTNode | undefined;
    let power: ASTNode | undefined;
    while (this.isOperator('_') || this.isOperator('^')) {
      const operator = this.take();
      if (operator.value === '_') {
        if (token.value !== 'log' || base) throw new MathError('Нижний индекс поддерживается только для основания логарифма.', operator.start);
        base = this.script('основание логарифма');
      } else {
        if (power) throw new MathError('У функции может быть только один показатель степени.', operator.start);
        power = this.script('показатель степени функции');
      }
    }
    const args: ASTNode[] = [];
    if (this.peek().kind === 'open' && this.peek().value !== '{') {
      const opening = this.take();
      if (this.peek().kind === 'close' || this.peek().kind === 'eof') throw new MathError(`Заполните аргумент функции ${token.value}.`, this.peek().start);
      args.push(this.expression());
      while (this.peek().kind === 'comma') { this.take(); args.push(this.expression()); }
      this.close(opening);
    } else {
      args.push(this.nested(() => this.unary()));
      while (startsAtom(this.peek()) && this.peek().kind !== 'function' && (this.peek().kind !== 'bar' || this.peek().value === 'open')) {
        args[0] = this.binary('*', args[0], this.nested(() => this.postfix()));
      }
    }
    if (base) {
      if (args.length !== 1) throw new MathError('Для логарифма с основанием нужен один аргумент.', token.start);
      args.push(base);
    }
    if (power?.type === 'unary' && power.operator === '-' && power.argument.type === 'number' && /^0*1$/.test(power.argument.value)) {
      const inverseNames: Record<string, string> = { sin: 'asin', cos: 'acos', tan: 'atan' };
      if (!Object.hasOwn(inverseNames, token.value)) throw new MathError('Обратная функция не поддерживается. Для обратного значения возведите выражение в степень −1 после скобок.', token.start);
      return this.call(inverseNames[token.value], args, token);
    }
    const node = this.call(token.value, args, token);
    return power ? this.binary('^', node, power) : node;
  }
  private primary(allowMixed = true): ASTNode {
    const token = this.take();
    if (token.kind === 'number') {
      const whole = this.node({ type: 'number', value: token.value, start: token.start, end: token.end } as const);
      if (allowMixed && /^\d+$/.test(token.value) && this.peek().kind === 'fraction') {
        const fraction = this.fraction(this.take());
        if (fraction.type !== 'binary') throw new MathError('Проверьте смешанное число.', token.start);
        return this.call('mixed', [whole, fraction.left, fraction.right], token);
      }
      return whole;
    }
    if (token.kind === 'constant') return this.node({ type: 'constant', name: token.value as 'pi' | 'e', start: token.start, end: token.end });
    if (token.kind === 'variable') return this.node({ type: 'variable', name: token.value, start: token.start, end: token.end });
    if (token.kind === 'open') { this.cursor--; return this.group(); }
    if (token.kind === 'fraction') return this.fraction(token);
    if (token.kind === 'binomial') return this.call('ncr', [this.singleAtom('верхнюю ячейку сочетания'), this.singleAtom('нижнюю ячейку сочетания')], token);
    if (token.kind === 'root') {
      const index = this.peek().kind === 'open' && this.peek().value === '[' ? this.group('степень корня') : undefined;
      const radicand = this.singleAtom('подкоренное выражение');
      return this.call(index ? 'root' : 'sqrt', index ? [radicand, index] : [radicand], token);
    }
    if (token.kind === 'function') return this.nested(() => this.function(token));
    if (token.kind === 'bar') {
      if (token.value === 'close') throw new MathError('Заполните выражение внутри модуля.', token.start);
      this.bars++;
      try {
        const argument = this.expression();
        const closing = this.take();
        if (closing.kind !== 'bar' || closing.value === 'open') throw new MathError('Не закрыт знак модуля.', token.start);
        return this.call('abs', [argument], token);
      } finally { this.bars--; }
    }
    if (token.kind === 'eof' || token.kind === 'close') throw new MathError('Заполните ячейку: ожидается число или выражение.', token.start);
    throw new MathError(`После знака ожидается число или выражение, а не «${token.value}».`, token.start);
  }
}

export function expressionToLatex(expression: string): string {
  return editorLatex(parse(expression));
}

export function latexToExpression(latex: string): string {
  const expression = formatAST(new LatexParser(tokenizeLatex(latex)).parse());
  parse(expression);
  return expression;
}
