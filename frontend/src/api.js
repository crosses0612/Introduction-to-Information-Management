const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

function withAuth(headers = {}) {
  const token = localStorage.getItem("token");
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
  getReminders: () => request("/reminders"),
  getPendingAlert: () => request("/orders/pending-alert"),
  getStats: () => request("/stats")
};
