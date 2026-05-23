const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

function withAuth(headers = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...withAuth(options.headers)
    }
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  register: (payload) => request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  getProducts: () => request("/products"),
  createProduct: (payload) => request("/products", { method: "POST", body: JSON.stringify(payload) }),
  updateProduct: (id, payload) =>
    request(`/products/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),
  updateRecipe: (id, recipe) =>
    request(`/products/${id}/recipe`, { method: "PUT", body: JSON.stringify({ recipe }) }),
  getMaterials: () => request("/materials"),
  createMaterial: (payload) => request("/materials", { method: "POST", body: JSON.stringify(payload) }),
  updateMaterial: (id, payload) =>
    request(`/materials/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteMaterial: (id) => request(`/materials/${id}`, { method: "DELETE" }),
  createOrder: (payload) => request("/orders", { method: "POST", body: JSON.stringify(payload) }),
  getMyOrders: () => request("/orders/my"),
  getAllOrders: () => request("/orders"),
  confirmOrder: (id) => request(`/orders/${id}/confirm`, { method: "PUT" }),
  cancelOrder: (id) => request(`/orders/${id}/cancel`, { method: "PUT" }),
  getReminders: () => request("/reminders"),
  getPendingAlert: () => request("/orders/pending-alert"),
  getStats: () => request("/stats"),
  getLowStockMaterials: () => request("/materials/low-stock"),
  inboundMaterial: (id, payload) =>
    request(`/materials/${id}/inbound`, { method: "POST", body: JSON.stringify(payload) }),
  getMaterialMovements: (params = {}) => {
    const q = new URLSearchParams();
    if (params.materialId) q.set("materialId", params.materialId);
    if (params.limit) q.set("limit", params.limit);
    const qs = q.toString();
    return request(`/materials/movements${qs ? `?${qs}` : ""}`);
  },
  getMaterialConsumptionStats: () => request("/materials/consumption-stats"),
  getProfile: () => request("/profile"),
  updateProfile: (payload) => request("/profile", { method: "PUT", body: JSON.stringify(payload) }),
  getShopInfo: () => request("/shop-info"),
  getVendorSettings: () => request("/vendor/settings"),
  updateVendorSettings: (payload) =>
    request("/vendor/settings", { method: "PUT", body: JSON.stringify(payload) }),
  getVendorOrders: (scope) => request(`/orders?scope=${scope}`),
  completeOrder: (id) => request(`/orders/${id}/complete`, { method: "PUT" })
};
