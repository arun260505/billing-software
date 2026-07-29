import api from "./api";

const getMenuItems = async () => {
    const response = await api.get("/menu");
    return response.data;
};

const getSummary = async () => {
    const response = await api.get("/menu/summary");
    return response.data;
};

const getCategories = async () => {
    const response = await api.get("/categories");
    // Categories now come back in the standard { success, message, data } envelope.
    const categories = response.data.data || [];
    return categories.filter(c => c.status === "Active");
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

export default {
    getMenuItems,
    getSummary,
    getCategories,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem
};