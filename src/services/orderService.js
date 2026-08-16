import api from "./api";

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

export const updateOrder = (id, data) =>
  api.put(`/orders/${id}`, data);

export const cancelOrder = (id) =>
  api.delete(`/orders/${id}`);