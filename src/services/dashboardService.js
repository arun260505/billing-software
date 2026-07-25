import axios from "axios";

const API_URL = "http://localhost:5000/api/dashboard";

export const getDashboardSummary = () => {
    return axios.get(`${API_URL}/summary`);
};
export const getRecentOrders = () => {
    return axios.get(`${API_URL}/recent-orders`);
};
export const getTopItems = () => {
    return axios.get(`${API_URL}/top-items`);
};
export const getTableStatus = () => {
    return axios.get(`${API_URL}/tables`);
};
export const getSalesChart = (period) => {
    return axios.get(`${API_URL}/sales-chart?period=${period}`);
};