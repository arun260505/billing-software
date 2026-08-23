import api from "./api";

// Full tenant order list (admin Orders page).
export const getOrders = () =>
  api.get("/orders");

export const createOrder = (data) =>
  api.post("/orders", data);

export const getRunningOrders = () =>
  api.get("/orders/running");

export const getTodaysOrderCount = () =>
  api.get("/orders/today-count");

export const getOrderDetails = (id) =>
  api.get(`/orders/${id}/items`);

export const getTableItems = (tableId) =>
  api.get(`/orders/table/${tableId}/items`);

export const settleTable = (tableId, paymentMethod = "Cash") =>
  api.post(`/orders/table/${tableId}/settle`, { payment_method: paymentMethod });

// ---------------------------------------------------------------------------
// Bills — today's settled bills, so the cashier can correct an item that was
// rung up twice or missed, then reprint.
// ---------------------------------------------------------------------------
export const getTodaysBills = () =>
  api.get("/orders/bills/today");

export const getBill = (orderId) =>
  api.get(`/orders/bills/${orderId}`);

// Add an item to THIS bill (works on a settled or counter bill, unlike
// addBillItem which needs a table with an open order).
export const addItemToOrder = (orderId, menuItemId, quantity = 1) =>
  api.post(`/orders/${orderId}/item`, { menu_item_id: menuItemId, quantity });

// Recompute an edited bill and bring the recorded payment into line.
export const rebillOrder = (orderId, paymentMethod) =>
  api.put(`/orders/${orderId}/rebill`, { payment_method: paymentMethod });

export const markOrderServed = (id) =>
  api.put(`/orders/${id}/serve`);

export const markTableServed = (tableId) =>
  api.put(`/orders/table/${tableId}/serve`);

export const markItemServed = (itemId) =>
  api.put(`/orders/item/${itemId}/serve`);

export const cancelItem = (itemId) =>
  api.delete(`/orders/item/${itemId}`);

export const setItemQuantity = (itemId, quantity) =>
  api.put(`/orders/item/${itemId}/qty`, { quantity });

export const addBillItem = (tableId, menuItemId, quantity = 1) =>
  api.post(`/orders/table/${tableId}/item`, { menu_item_id: menuItemId, quantity });

export const updateOrder = (id, data) =>
  api.put(`/orders/${id}`, data);

export const cancelOrder = (id) =>
  api.delete(`/orders/${id}`);