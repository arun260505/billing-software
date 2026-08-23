import api from "./api";

// Tenant payment records (admin Orders page uses them to show
// method / reference info on an order when it exists).
export const getPayments = () =>
  api.get("/payments");

export const createPayment = (data) =>
  api.post("/payments", data);
