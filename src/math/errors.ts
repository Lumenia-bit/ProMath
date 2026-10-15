export class MathError extends Error {
  constructor(message: string, public readonly position = 0, public readonly length = 1) {
    super(message);
    this.name = 'MathError';
  }
}
