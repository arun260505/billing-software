import api from "./api";

export const getCustomers = () =>
    api.get("/customers");

export const getCustomer = (id) =>
    api.get(`/customers/${id}`);

// { customer, bills } — every bill rung up for this customer, newest first.
export const getCustomerHistory = (id) =>
    api.get(`/customers/${id}/history`);

// The customer with this mobile number, or data: null when they're new.
export const lookupCustomer = (mobile) =>
    api.get("/customers/lookup", { params: { mobile } });

// Suggestions while typing: 3+ digits of a mobile number or 2+ letters of a name.
export const searchCustomers = (q) =>
    api.get("/customers/search", { params: { q } });

// Billing counter: returns the customer with this mobile, creating them first
// when they're new (customer_name is then required).
export const resolveCustomer = (data) =>
    api.post("/customers/resolve", data);

export const createCustomer = (data) =>
    api.post("/customers", data);

export const updateCustomer = (id, data) =>
    api.put(`/customers/${id}`, data);

export const deleteCustomer = (id) =>
    api.delete(`/customers/${id}`);
