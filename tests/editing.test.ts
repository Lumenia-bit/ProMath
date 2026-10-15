import { describe, expect, it } from 'vitest';
import { deleteAtSelection, insertAtSelection } from '../src/utils/editing';

describe('cursor editing', () => {
  it('inserts a function in the middle and places the cursor inside its parentheses', () => {
    expect(insertAtSelection('2+3', 2, 2, { text: 'sqrt()', cursor: 5 }))
      .toEqual({ value: '2+sqrt()3', cursor: 7 });
  });

  it('replaces a selected expression with an operator', () => {
    expect(insertAtSelection('12+34', 2, 3, { text: '*' }))
      .toEqual({ value: '12*34', cursor: 3 });
  });

  it('wraps the selected expression in a function', () => {
    expect(insertAtSelection('2+3*4', 2, 5, { text: 'sqrt()', cursor: 5, wrap: ['sqrt(', ')'] }))
      .toEqual({ value: '2+sqrt(3*4)', cursor: 11 });
  });

  it('deletes only the selected range', () => {
    expect(deleteAtSelection('12+34', 2, 4)).toEqual({ value: '124', cursor: 2 });
  });

  it('backspaces the character immediately before the cursor', () => {
    expect(deleteAtSelection('12+34', 3, 3)).toEqual({ value: '1234', cursor: 2 });
  });

  it('keeps the input unchanged when backspace is pressed at the beginning', () => {
    expect(deleteAtSelection('12+34', 0, 0)).toEqual({ value: '12+34', cursor: 0 });
  });
});
