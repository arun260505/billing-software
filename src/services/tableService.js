import api from "./api";

// ---------------------------------------------------------------------------
// Waiter board (named exports)
// Maps our DB shape/status to what the waiter UI expects (table_number,
// FREE/OCCUPIED).
// ---------------------------------------------------------------------------
export const getTables = async () => {
    const response = await api.get("/tables");
    const rows = response.data.data || [];
    const data = rows.map((t) => ({
        ...t,
        table_number: t.table_name,
        status: t.status === "Available" ? "FREE" : "OCCUPIED"
    }));
    return { success: true, data };
};

export const updateTableStatus = async (id, status) => {
    const response = await api.put(`/tables/${id}/status`, { status });
    return response.data;
};

// ---------------------------------------------------------------------------
// Admin table management (default export)
// ---------------------------------------------------------------------------
const tableService = {

    getAllTables() {
        return api.get("/tables");
    },

    getDashboardStats() {
        return api.get("/tables/dashboard/stats");
    },

    getTable(id) {
        return api.get(`/tables/${id}`);
    },

    createTable(data) {
        return api.post("/tables", data);
    },

    updateTable(id, data) {
        return api.put(`/tables/${id}`, data);
    },

    deleteTable(id) {
        return api.delete(`/tables/${id}`);
    }

};

export default tableService;
