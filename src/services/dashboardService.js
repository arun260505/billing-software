import api from "./api";

const API = "/dashboard";

export const getDashboardSummary = () => api.get(`${API}/summary`);
export const getRecentOrders = () => api.get(`${API}/recent-orders`);
export const getTopItems = () => api.get(`${API}/top-items`);
export const getTableStatus = () => api.get(`${API}/tables`);
export const getSalesChart = (period) => api.get(`${API}/sales-chart?period=${period}`);
export const getDashboardHealth = () => api.get(`${API}/health`);
