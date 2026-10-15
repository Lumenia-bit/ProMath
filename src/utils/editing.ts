export interface Insertion { text: string; cursor?: number; wrap?: [string, string] }
export function insertAtSelection(value: string, start: number, end: number, insertion: Insertion) {
  const selected = value.slice(start, end);
  const text = selected && insertion.wrap ? insertion.wrap[0] + selected + insertion.wrap[1] : insertion.text;
  const cursor = start + (selected && insertion.wrap ? text.length : insertion.cursor ?? text.length);
  return { value: value.slice(0, start) + text + value.slice(end), cursor };
}
export function deleteAtSelection(value: string, start: number, end: number) {
  const from = start === end ? Math.max(0, start - 1) : start;
  return { value: value.slice(0, from) + value.slice(end), cursor: from };
}
