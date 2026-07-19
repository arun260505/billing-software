import api from "./api";

export const getTables = async () => {
    const response = await api.get("/tables");
    return response.data;
};

export const updateTableStatus = async (id, status) => {
    const response = await api.put(`/tables/${id}/status`, { status });
    return response.data;
};