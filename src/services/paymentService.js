import api from "./api";

export const createPayment = (data) =>
  api.post("/payments", data);
