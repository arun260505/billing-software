import api from "./api";

const API = "/dashboard";

// The client's own local (IST) date, sent so "today" figures match the wall
// clock in front of the owner — the cloud server runs in UTC, so its CURDATE()
// is a day behind after IST midnight and "today" would otherwise read zero.
const todayLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const getDashboardSummary = () => api.get(`${API}/summary`, { params: { date: todayLocal() } });
export const getRecentOrders = () => api.get(`${API}/recent-orders`);
export const getTopItems = () => api.get(`${API}/top-items`);
export const getTableStatus = () => api.get(`${API}/tables`);
export const getSalesChart = (period) => api.get(`${API}/sales-chart`, { params: { period, date: todayLocal() } });
export const getDashboardHealth = () => api.get(`${API}/health`);
export const getWaiterActivity = () => api.get(`${API}/waiters`, { params: { date: todayLocal() } });
