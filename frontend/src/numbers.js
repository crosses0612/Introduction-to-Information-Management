export function nonNegativeFromInput(value, fallback = 0) {
  if (value === "" || value == null) return fallback;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return 0;
  return n;
}

export function nonNegativeStringFromInput(value) {
  if (value === "" || value == null) return "";
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return "0";
  return value;
}
