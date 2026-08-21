import api from "./api";

// ---------------------------------------------------------------------------
// Waiter ordering screen (named exports)
// ---------------------------------------------------------------------------
export const getCategories = () => api.get("/menu/categories");
export const getAllItems = () => api.get("/menu/items");
export const getItemsByCategory = (id) => api.get(`/menu/items/category/${id}`);

// Cashier/admin: mark an item available (1) or unavailable (0).
export const setItemAvailability = (id, available) =>
    api.patch(`/menu/${id}/availability`, { available });

// ---------------------------------------------------------------------------
// Admin menu management (default export)
// ---------------------------------------------------------------------------
const getMenuItems = async () => {
    const response = await api.get("/menu");
    return response.data;
};

const getSummary = async () => {
    const response = await api.get("/menu/summary");
    return response.data;
};

const getAdminCategories = async () => {
    const response = await api.get("/categories");
    const categories = response.data.data || [];
    return categories.filter((c) => c.status === "Active");
};

const addMenuItem = async (data) => {
    const response = await api.post("/menu", data);
    return response.data;
};

const updateMenuItem = async (id, data) => {
    const response = await api.put(`/menu/${id}`, data);
    return response.data;
};

const deleteMenuItem = async (id) => {
    const response = await api.delete(`/menu/${id}`);
    return response.data;
};

// Admin: manual per-item availability toggle.
const setAvailability = async (id, available) => {
    const response = await setItemAvailability(id, available);
    return response.data;
};

const menuService = {
    getMenuItems,
    getSummary,
    getCategories: getAdminCategories,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    setAvailability
};

export default menuService;
