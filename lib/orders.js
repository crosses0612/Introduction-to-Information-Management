export function parseItemsField(items) {
  if (!items) return [];
  return typeof items === "string" ? JSON.parse(items) : items;
}

export function mapOrderRow(row) {
  const deliveryAt = row.delivery_at ?? row.delivery_date;
  return {
    ...row,
    delivery_at: deliveryAt,
    delivery_date: deliveryAt,
    items: parseItemsField(row.items)
  };
}

export function validateDeliveryAt(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) {
    throw new Error("交貨日期時間格式不正確");
  }
  const year = d.getFullYear();
  const currentYear = new Date().getFullYear();
  if (year < currentYear) {
    throw new Error("交貨日期不可早於今年");
  }
  if (year > currentYear + 2) {
    throw new Error("交貨日期過遠，請重新選擇");
  }
  return d.toISOString();
}

export function validateDeliveryMethod(method, address) {
  if (!method || !["pickup", "delivery"].includes(method)) {
    throw new Error("請選擇來店自取或配送");
  }
  if (method === "delivery" && (!address || !String(address).trim())) {
    throw new Error("配送請填寫收貨地址");
  }
}
