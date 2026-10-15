import { MathError } from './errors';
import { LIMITS } from './limits';

const absolute = (value: bigint) => value < 0n ? -value : value;
const digits = (value: bigint) => absolute(value).toString().length;

export function bigintGcd(a: bigint, b: bigint): bigint {
  a = absolute(a);
  b = absolute(b);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function checkSize(value: bigint) {
  if (digits(value) > LIMITS.digits) throw new MathError(`Результат слишком большой: максимум ${LIMITS.digits} цифр.`);
}

function checkedProduct(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  if (digits(a) + digits(b) - 1 > LIMITS.digits) throw new MathError('Произведение слишком большое. Уменьшите числа или показатель степени.');
  const result = a * b;
  checkSize(result);
  return result;
}

/** Immutable reduced rational; decimal input is never converted through a float. */
export class Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;

  constructor(numerator: bigint, denominator = 1n) {
    if (denominator === 0n) throw new MathError('Нельзя делить на ноль.');
    checkSize(numerator);
    checkSize(denominator);
    if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
    const divisor = bigintGcd(numerator, denominator);
    this.numerator = numerator / divisor;
    this.denominator = denominator / divisor;
  }

  static fromString(input: string): Rational {
    const match = input.match(/^([+-]?)(\d+(?:\.\d*)?|\.\d+)(?:[eE]([+-]?\d+))?$/u);
    if (!match) throw new MathError('Некорректная запись числа.');
    const exponentText = match[3] ?? '0';
    if (exponentText.replace(/^[+-]?0*/u, '').length > 4) throw new MathError('Показатель научной записи слишком большой.');
    const exponent = Number(exponentText);
    if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > LIMITS.scientificExponent) throw new MathError(`Показатель научной записи должен быть от −${LIMITS.scientificExponent} до ${LIMITS.scientificExponent}.`);
    const [integer, fractional = ''] = match[2].split('.');
    const rawDigits = `${integer}${fractional}`.replace(/^0+/u, '') || '0';
    const shift = exponent - fractional.length;
    if (rawDigits.length + Math.max(0, shift) > LIMITS.digits || -shift + 1 > LIMITS.digits) throw new MathError('Число содержит слишком много цифр.');
    let numerator = BigInt(rawDigits) * (match[1] === '-' ? -1n : 1n);
    let denominator = 1n;
    if (shift >= 0) numerator *= 10n ** BigInt(shift);
    else denominator = 10n ** BigInt(-shift);
    return new Rational(numerator, denominator);
  }

  static parse(input: string) { return Rational.fromString(input); }
  get isInteger() { return this.denominator === 1n; }

  add(other: Rational): Rational {
    const common = bigintGcd(this.denominator, other.denominator);
    const leftScale = other.denominator / common;
    const rightScale = this.denominator / common;
    const numerator = checkedProduct(this.numerator, leftScale) + checkedProduct(other.numerator, rightScale);
    const reduction = bigintGcd(numerator, common);
    return new Rational(numerator / reduction, checkedProduct(rightScale, other.denominator / reduction));
  }

  subtract(other: Rational) { return this.add(other.negate()); }

  multiply(other: Rational): Rational {
    const crossLeft = bigintGcd(this.numerator, other.denominator);
    const crossRight = bigintGcd(other.numerator, this.denominator);
    return new Rational(
      checkedProduct(this.numerator / crossLeft, other.numerator / crossRight),
      checkedProduct(this.denominator / crossRight, other.denominator / crossLeft),
    );
  }

  divide(other: Rational): Rational {
    if (other.numerator === 0n) throw new MathError('Нельзя делить на ноль.');
    return this.multiply(new Rational(other.denominator, other.numerator));
  }

  modulo(other: Rational): Rational {
    if (other.numerator === 0n) throw new MathError('Нельзя вычислить остаток при делении на ноль.');
    const quotient = this.divide(other);
    const whole = quotient.numerator / quotient.denominator;
    return this.subtract(other.multiply(new Rational(whole)));
  }

  pow(exponent: number | bigint): Rational {
    if (typeof exponent === 'number' && !Number.isSafeInteger(exponent)) throw new MathError('Для точной рациональной степени нужен целый показатель.');
    const power = BigInt(exponent);
    if (absolute(power) > BigInt(LIMITS.exponent)) throw new MathError(`Показатель степени по модулю не должен превышать ${LIMITS.exponent}.`);
    if (this.numerator === 0n && power <= 0n) throw new MathError(power === 0n ? 'Ноль в нулевой степени не определён.' : 'Ноль нельзя возводить в отрицательную степень.');
    const magnitude = Number(absolute(power));
    if ((digits(this.numerator) - 1) * magnitude + 1 > LIMITS.digits || (digits(this.denominator) - 1) * magnitude + 1 > LIMITS.digits) throw new MathError('Степень даёт слишком большой результат.');
    const numerator = this.numerator ** absolute(power);
    const denominator = this.denominator ** absolute(power);
    return power < 0n ? new Rational(denominator, numerator) : new Rational(numerator, denominator);
  }

  negate() { return new Rational(-this.numerator, this.denominator); }
  abs() { return new Rational(absolute(this.numerator), this.denominator); }
  equals(other: Rational) { return this.numerator === other.numerator && this.denominator === other.denominator; }

  toNumber(): number {
    const numerator = Number(this.numerator);
    const denominator = Number(this.denominator);
    if (Number.isFinite(numerator) && Number.isFinite(denominator)) return numerator / denominator;
    const numeratorText = absolute(this.numerator).toString();
    const denominatorText = this.denominator.toString();
    const numeratorLeading = Number(numeratorText.slice(0, 16));
    const denominatorLeading = Number(denominatorText.slice(0, 16));
    const exponent = Math.max(0, numeratorText.length - 16) - Math.max(0, denominatorText.length - 16);
    const [mantissa, leadingExponent] = (numeratorLeading / denominatorLeading).toExponential(16).split('e');
    return Number(`${this.numerator < 0n ? '-' : ''}${mantissa}e${Number(leadingExponent) + exponent}`);
  }

  toString() { return this.denominator === 1n ? this.numerator.toString() : `${this.numerator}/${this.denominator}`; }
}
