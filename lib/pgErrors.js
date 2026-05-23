export function mapPgError(error) {
  if (!error) return null;
  const code = error.code;
  const message = error.message || "";

  if (code === "22003" || code === "22P02") {
    if (message.includes("integer") || message.includes("整數")) {
      return "輸入的整數過大";
    }
    return "輸入的數值格式不正確";
  }
  if (code === "23505") {
    if (message.includes("materials_name")) return "原料名稱已存在";
    if (message.includes("products")) return "商品名稱已存在";
    if (message.includes("username") || message.includes("users_email")) return "此使用者名稱已被使用";
    return "資料重複";
  }
  return null;
}
