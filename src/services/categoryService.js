import api from "./api";

// Get all categories
const getCategories = () => {
    return api.get("/categories");
};

// Get summary
const getSummary = () => {
    return api.get("/categories/summary");
};

// Add category
const addCategory = async (data) => {

    const response = await api.post("/categories", data);

    return response.data;

};

// Update category
const updateCategory = async (id, data) => {

    const response = await api.put(`/categories/${id}`, data);

    return response.data;

};

// Delete category
const deleteCategory = async (id) => {

    const response = await api.delete(`/categories/${id}`);

    return response.data;

};

const categoryService = {
    getCategories,
    getSummary,
    addCategory,
    updateCategory,
    deleteCategory
};

export default categoryService;