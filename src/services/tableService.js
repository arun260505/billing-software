import api from "./api";

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