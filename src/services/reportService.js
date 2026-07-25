import axios from "axios";

const API_URL = "http://localhost:5000/api/reports";

export const getDailySales = () =>
    axios.get(`${API_URL}/daily-sales`);

export const getMonthlySales = () =>
    axios.get(`${API_URL}/monthly-sales`);

export const getPaymentSummary = () =>
    axios.get(`${API_URL}/payment-summary`);

export const getTopSellingItems = () =>
    axios.get(`${API_URL}/top-selling-items`);

export const getEmployeeSales = () =>
    axios.get(`${API_URL}/employee-sales`);

export const getTableSales = () =>
    axios.get(`${API_URL}/table-sales`);