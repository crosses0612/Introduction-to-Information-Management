const STATUS_LABELS = {
  pending: "待處理",
  confirmed: "已確認",
  cancelled: "已取消",
  completed: "已完成"
};

const METHOD_LABELS = {
  pickup: "來店自取",
  delivery: "配送"
};

export function orderStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

export function deliveryMethodLabel(method) {
  return METHOD_LABELS[method] || method || "-";
}
