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

const MAX_SAFE_INT = 99999;

export function assertSafeInteger(value, label, max = MAX_SAFE_INT) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`${label}必須為整數`);
  }
  if (n < 0) {
    throw new Error(`${label}不可為負數`);
  }
  if (n > max) {
    throw new Error("輸入的整數過大");
  }
  return n;
}

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

// 保留使用者輸入中的小數中間狀態（如 "0"、"0."、".5"、"0.05"），不可即時轉成數字，
// 否則無法以 0 或小數點作為開頭輸入。僅過濾不合法字元與負號。
export function decimalStringFromInput(value) {
  if (value === "" || value == null) return "";
  const str = String(value);
  // 僅允許數字與單一小數點
  if (!/^\d*\.?\d*$/.test(str)) return "";
  return str;
}
