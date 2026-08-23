import api from "./api";

const getCharges = () => api.get("/charges");
const getSummary = () => api.get("/charges/summary");
const createCharge = (data) => api.post("/charges", data);
const updateCharge = (id, data) => api.put(`/charges/${id}`, data);
const deleteCharge = (id) => api.delete(`/charges/${id}`);
const duplicateCharge = (id) => api.post(`/charges/${id}/duplicate`);

const chargeService = {
    getCharges,
    getSummary,
    createCharge,
    updateCharge,
    deleteCharge,
    duplicateCharge
};

export default chargeService;
