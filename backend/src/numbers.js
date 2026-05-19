export function assertNonNegative(value, label) {
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) {
    throw new Error(`${label}不可為負數`);
  }
  return n;
}

export function assertPositive(value, label) {
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) {
    throw new Error(`${label}必須大於 0`);
  }
  return n;
}
