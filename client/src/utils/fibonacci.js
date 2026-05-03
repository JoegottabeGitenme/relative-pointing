// Standard scrum Fibonacci sequence used for relative story-point columns.
// `getFibonacciLabel(index)` returns the nth term as a string for use as a
// column heading. `index` is 0-based — index 0 → "1", index 1 → "2", etc.
//
// As columns are added or removed the caller passes the new sorted index,
// so each column's label slides up or down the sequence automatically.

const SEQUENCE = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

export function getFibonacciValue(index) {
  if (index < 0) return 1;
  if (index < SEQUENCE.length) return SEQUENCE[index];
  // Beyond the table, keep extending the sequence.
  let a = SEQUENCE[SEQUENCE.length - 2];
  let b = SEQUENCE[SEQUENCE.length - 1];
  for (let i = SEQUENCE.length; i <= index; i++) {
    const next = a + b;
    a = b;
    b = next;
  }
  return b;
}

export function getFibonacciLabel(index) {
  return String(getFibonacciValue(index));
}
