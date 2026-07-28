import api from "./api";

const API = "/employees";

const getEmployees = () => api.get(API);

const getSummary = () => api.get(`${API}/summary`);

const addEmployee = (data) => api.post(API, data);

const updateEmployee = (id, data) => api.put(`${API}/${id}`, data);

const deleteEmployee = (id) => api.delete(`${API}/${id}`);

export default {
    getEmployees,
    getSummary,
    addEmployee,
    updateEmployee,
    deleteEmployee
};