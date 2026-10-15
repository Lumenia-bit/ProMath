import type { ASTNode, BinaryOperator } from './ast';
import { MathError } from './errors';
import { LIMITS } from './limits';
import { tokenize, type Token } from './tokenizer';

const closingBrackets: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const beginsPrimary = (token: Token) => ['number', 'constant', 'variable', 'identifier', 'lparen'].includes(token.type);

class Parser {
  private cursor = 0;
  private recursion = 0;
  private nodeCount = 0;
  private readonly depths = new WeakMap<ASTNode, number>();

  constructor(private readonly tokens: Token[]) {}

  parse(): ASTNode {
    if (this.peek().type === 'eof') throw new MathError('Введите математическое выражение.', 0);
    const result = this.expression();
    const extra = this.peek();
    if (extra.type !== 'eof') {
      if (extra.type === 'rparen') throw new MathError('Лишняя закрывающая скобка.', extra.start);
      if (extra.type === 'comma') throw new MathError('Запятая разделяет аргументы только внутри функции.', extra.start);
      throw new MathError(`Неожиданный символ «${extra.value}».`, extra.start, extra.end - extra.start);
    }
    return result;
  }

  private peek(offset = 0) { return this.tokens[Math.min(this.cursor + offset, this.tokens.length - 1)]; }
  private take() { return this.tokens[this.cursor++]; }
  private isOperator(value: string) { return this.peek().type === 'operator' && this.peek().value === value; }

  private node<T extends ASTNode>(node: T, children: ASTNode[] = []): T {
    const depth = 1 + Math.max(0, ...children.map(child => this.depths.get(child) ?? 1));
    if (++this.nodeCount > LIMITS.nodes) throw new MathError('Выражение содержит слишком много операций.', node.start);
    if (depth > LIMITS.depth) throw new MathError('Выражение слишком вложенное. Разделите его на несколько вычислений.', node.start);
    this.depths.set(node, depth);
    return node;
  }

  private nested<T>(read: () => T): T {
    if (++this.recursion > LIMITS.depth) throw new MathError('Слишком много вложенных скобок или степеней.', this.peek().start);
    try { return read(); } finally { this.recursion--; }
  }

  private expression(): ASTNode {
    return this.nested(() => {
      let left = this.product();
      while (this.isOperator('+') || this.isOperator('-')) {
        const operator = this.take();
        left = this.binary(operator, left, this.requiredOperand(operator, () => this.product()));
      }
      return left;
    });
  }

  private product(): ASTNode {
    let left = this.unary();
    while (true) {
      if (this.isOperator('*') || this.isOperator('/') || (this.isOperator('%') && beginsPrimary(this.peek(1)))) {
        const operator = this.take();
        left = this.binary(operator, left, this.requiredOperand(operator, () => this.unary()));
      } else if (beginsPrimary(this.peek())) {
        const next = this.peek();
        if (this.tokens[this.cursor - 1]?.type === 'number' && next.type === 'number') throw new MathError('Между числами нужен оператор. Для смешанного числа используйте mixed(2, 1, 3).', next.start, next.end - next.start);
        left = this.binary({ ...next, value: '*' }, left, this.unary());
      } else break;
    }
    return left;
  }

  private unary(): ASTNode {
    if (this.isOperator('+') || this.isOperator('-')) {
      const operator = this.take();
      const argument = this.nested(() => this.requiredOperand(operator, () => this.unary()));
      return this.node({ type: 'unary', operator: operator.value as '+' | '-', argument, start: operator.start, end: argument.end }, [argument]);
    }
    return this.power();
  }

  private power(): ASTNode {
    const left = this.postfix();
    if (!this.isOperator('^')) return left;
    const operator = this.take();
    const right = this.nested(() => this.requiredOperand(operator, () => this.unary()));
    return this.binary(operator, left, right);
  }

  private postfix(): ASTNode {
    let argument = this.primary();
    while (this.isOperator('!') || (this.isOperator('%') && !beginsPrimary(this.peek(1)))) {
      const operator = this.take();
      argument = this.node({ type: operator.value === '!' ? 'factorial' : 'percentage', argument, start: argument.start, end: operator.end }, [argument]);
    }
    return argument;
  }

  private primary(): ASTNode {
    const token = this.take();
    if (token.type === 'number') return this.node({ type: 'number', value: token.value, start: token.start, end: token.end });
    if (token.type === 'constant') return this.node({ type: 'constant', name: token.value as 'pi' | 'e', start: token.start, end: token.end });
    if (token.type === 'variable') return this.node({ type: 'variable', name: token.value, start: token.start, end: token.end });
    if (token.type === 'identifier') {
      const opening = this.peek();
      if (opening.type !== 'lparen') throw new MathError(`После функции ${token.value} нужны скобки с аргументом.`, opening.start);
      this.take();
      if (this.peek().type === 'rparen') throw new MathError(`Функции ${token.value} нужен аргумент.`, this.peek().start);
      const args: ASTNode[] = [];
      if (this.peek().type !== 'rparen') {
        args.push(this.expression());
        while (this.peek().type === 'comma') {
          const comma = this.take();
          if (this.peek().type === 'rparen' || this.peek().type === 'eof') throw new MathError('После запятой ожидается аргумент функции.', comma.end);
          args.push(this.expression());
        }
      }
      const closing = this.closeBracket(opening);
      if (token.value === 'var') {
        const argument = args[0];
        if (args.length !== 1 || !argument || !((argument.type === 'variable' || argument.type === 'constant') && /^[a-z]$/.test(argument.name))) {
          throw new MathError('Для переменной укажите одну букву от a до z: например var(e).', token.start, closing.end - token.start);
        }
        return this.node({ type: 'variable', name: argument.name, start: token.start, end: closing.end });
      }
      return this.node({ type: 'function', name: token.value, args, start: token.start, end: closing.end }, args);
    }
    if (token.type === 'lparen') {
      if (this.peek().type === 'rparen') throw new MathError('Внутри скобок ожидается выражение.', this.peek().start);
      const result = this.expression();
      this.closeBracket(token);
      return result;
    }
    if (token.type === 'rparen') throw new MathError('Перед закрывающей скобкой ожидается число или выражение.', token.start);
    if (token.type === 'eof') throw new MathError('Ожидается число или выражение.', token.start);
    throw new MathError(`Вместо «${token.value}» ожидается число или выражение.`, token.start, Math.max(1, token.end - token.start));
  }

  private closeBracket(opening: Token): Token {
    const closing = this.peek();
    if (closing.type !== 'rparen') throw new MathError(`Не закрыта скобка «${opening.value}».`, opening.start);
    if (closing.value !== closingBrackets[opening.value]) throw new MathError(`Для «${opening.value}» нужна закрывающая скобка «${closingBrackets[opening.value]}».`, closing.start);
    return this.take();
  }

  private requiredOperand(operator: Token, read: () => ASTNode): ASTNode {
    const next = this.peek();
    if (next.type === 'eof' || next.type === 'rparen' || next.type === 'comma') {
      const label = operator.value === '*' ? '×' : operator.value === '/' ? '÷' : operator.value;
      throw new MathError(`После оператора ${label} ожидается число или выражение.`, operator.start, operator.end - operator.start);
    }
    return read();
  }

  private binary(operator: Token, left: ASTNode, right: ASTNode): ASTNode {
    return this.node({ type: 'binary', operator: operator.value as BinaryOperator, left, right, start: left.start, end: right.end }, [left, right]);
  }
}

export function parse(input: string): ASTNode { return new Parser(tokenize(input)).parse(); }
