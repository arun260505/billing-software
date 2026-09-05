import api from "./api";

const createAdmin = async (data) => {

    const response = await api.post(
        "/super-admin/create-admin",
        data
    );

    return response.data;

};

const getAdmins = async () => {

    const response = await api.get(
        "/super-admin/admins"
    );

    return response.data;

};

const updateAdmin = async (id, data) => {

    const response = await api.put(
        `/super-admin/admin/${id}`,
        data
    );

    return response.data;

};

const deleteAdmin = async (id) => {

    const response = await api.delete(
        `/super-admin/admin/${id}`
    );

    return response.data;

};

const superAdminService = {
    createAdmin,
    getAdmins,
    updateAdmin,
    deleteAdmin
};

export default superAdminService;