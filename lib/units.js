// 單位換算：同類別（質量/體積）的單位可互相換算，其餘（桶、包、罐等）視為不可換算。
// key 需與前端 DEFAULT_UNITS 字串一致。factor 為「換算到該類別基準單位」的倍率。
const UNIT_FACTORS = {
  // 質量，基準為公克
  "公斤 (kg)": { category: "mass", factor: 1000 },
  "公克 (g)": { category: "mass", factor: 1 },
  "磅 (lb)": { category: "mass", factor: 453.59237 },
  // 體積，基準為公升
  "公升 (L)": { category: "volume", factor: 1 },
  "加侖 (gal)": { category: "volume", factor: 3.785411784 }
};

export function canConvertUnit(fromUnit, toUnit) {
  const from = UNIT_FACTORS[fromUnit];
  const to = UNIT_FACTORS[toUnit];
  return Boolean(from && to && from.category === to.category);
}

// 將 value 由 fromUnit 換算為 toUnit；不可換算時回傳 null。
export function convertUnit(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return Number(value);
  if (!canConvertUnit(fromUnit, toUnit)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const converted = (n * UNIT_FACTORS[fromUnit].factor) / UNIT_FACTORS[toUnit].factor;
  // 避免浮點誤差留下過長尾數
  return Math.round(converted * 1e6) / 1e6;
}
