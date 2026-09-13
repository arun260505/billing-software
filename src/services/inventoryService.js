import api from "./api";

export const getInventory = () =>
    api.get("/inventory");

export const getInventorySummary = () =>
    api.get("/inventory/summary");

export const createInventoryItem = (data) =>
    api.post("/inventory", data);

// Details only — quantity changes go through moveStock so they're logged.
export const updateInventoryItem = (id, data) =>
    api.put(`/inventory/${id}`, data);

export const deleteInventoryItem = (id) =>
    api.delete(`/inventory/${id}`);

// movement_type: "In" (received) | "Out" (used) | "Adjust" (counted quantity).
export const moveStock = (id, data) =>
    api.post(`/inventory/${id}/stock`, data);

// The movement log — for one item when `itemId` is given, else all items.
export const getStockMovements = (itemId = null) =>
    api.get(itemId ? `/inventory/${itemId}/movements` : "/inventory/movements");
