import api from "./api";

const API = "/reports";

export const getDailySales = () => api.get(`${API}/daily-sales`);
export const getMonthlySales = () => api.get(`${API}/monthly-sales`);
export const getPaymentSummary = () => api.get(`${API}/payment-summary`);
export const getTopSellingItems = () => api.get(`${API}/top-selling-items`);
export const getEmployeeSales = () => api.get(`${API}/employee-sales`);
export const getTableSales = () => api.get(`${API}/table-sales`);
