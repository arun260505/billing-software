import api from "./api";

const settingsService = {
    // Restaurant
    getRestaurant: () => api.get("/settings/restaurant"),
    saveRestaurant: (data) => api.put("/settings/restaurant", data),

    // Payments
    getPayments: () => api.get("/settings/payments"),
    savePayments: (data) => api.put("/settings/payments", data),

    // Security
    getSecurity: () => api.get("/settings/security"),
    saveSecurity: (data) => api.put("/settings/security", data),

    // Staff & Permissions
    getRoles: () => api.get("/settings/roles"),
    getPermissions: () => api.get("/settings/permissions"),
    getRolePermissions: (roleId) => api.get(`/settings/roles/${roleId}/permissions`),
    saveRolePermissions: (roleId, permissionIds) =>
        api.put(`/settings/roles/${roleId}/permissions`, { permission_ids: permissionIds }),

    // Password
    changePassword: (data) => api.put("/settings/change-password", data)
};

export default settingsService;
