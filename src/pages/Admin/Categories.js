import React, { useEffect, useState } from "react";
//import { toast } from "react-toastify";

import Sidebar from "../../components/Admin/Sidebar";
import Header from "../../components/Admin/Header";

import CategoryCards from "../../components/Admin/CategoryCards";
import CategoryFilters from "../../components/Admin/CategoryFilters";
import CategoryTable from "../../components/Admin/CategoryTable";
import CategoryModal from "../../components/Admin/CategoryModal";
import DeleteCategoryModal from "../../components/Admin/DeleteCategoryModal";

import categoryService from "../../services/categoryService";

import "../../styles/Admin/Dashboard.css";
import "../../styles/Admin/Categories.css";

function Categories() {

    const [categories, setCategories] = useState([]);

    const [summary, setSummary] = useState({});

    const [showModal, setShowModal] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(null);
const [isEditMode, setIsEditMode] = useState(false);
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [statusFilter, setStatusFilter] = useState("All");
const [currentPage, setCurrentPage] = useState(1);
const [itemsPerPage] = useState(10);

const [deleteCategory, setDeleteCategory] = useState(null);

    useEffect(() => {

        loadCategories();

        loadSummary();

    }, []);

    const loadCategories = () => {

        categoryService.getCategories()

            .then((res) => {

                setCategories(res.data.data || []);

            })

            .catch(console.error);

    };

    const loadSummary = () => {

        categoryService.getSummary()

            .then((res) => {

                setSummary(res.data.data);

            })

            .catch(console.error);

    };
    const handleEdit = (category) => {

    setSelectedCategory(category);

    setIsEditMode(true);

    setShowModal(true);

};
const handleDelete = (category) => {

    setDeleteCategory(category);

    setShowDeleteModal(true);

};
const confirmDelete = async () => {

    try {

        await categoryService.deleteCategory(deleteCategory.id);

        setShowDeleteModal(false);

        setDeleteCategory(null);

        loadCategories();

        loadSummary();

    } catch (err) {

        console.error(err);

        alert("Failed to delete category.");

    }

};
const handleSaveCategory = async (categoryData) => {

    try {

        if (isEditMode) {

            await categoryService.updateCategory(
                selectedCategory.id,
                categoryData
            );

            alert("Category updated successfully.");

        } else {

            await categoryService.addCategory({
                ...categoryData,
                restaurant_id: 2 // Temporary until JWT is updated
            });

            alert("Category added successfully.");

        }

        setShowModal(false);
        setSelectedCategory(null);
        setIsEditMode(false);

        loadCategories();
        loadSummary();

    } catch (err) {

        console.error(err);

        alert("Failed to save category.");

    }

};

const filteredCategories = categories.filter((category) => {
    const matchesSearch =
        category.category_name
            .toLowerCase()
            .includes(search.toLowerCase());

    const matchesStatus =
        statusFilter === "All" ||
        category.status === statusFilter;

    return matchesSearch && matchesStatus;
});
const indexOfLastItem = currentPage * itemsPerPage;
const indexOfFirstItem = indexOfLastItem - itemsPerPage;

const currentCategories = filteredCategories.slice(
    indexOfFirstItem,
    indexOfLastItem
);

const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);
    return (

        <div className="dashboard-container">

            <Sidebar />

            <div className="dashboard-main">

                <Header />

                <div className="dashboard-content">

                    <div className="page-header">

                        <h2>Category Management</h2>

                        <p>Manage restaurant menu categories.</p>

                    </div>

                    <CategoryCards summary={summary} />
<CategoryFilters
    search={search}
    onSearch={setSearch}
    statusFilter={statusFilter}
    onStatusChange={setStatusFilter}
    onAdd={() => {
        setSelectedCategory(null);
        setIsEditMode(false);
        setShowModal(true);
    }}
/>
   
            <CategoryTable
    categories={currentCategories}
    onEdit={handleEdit}
    onDelete={handleDelete}
/>
<div className="pagination">

    <button
        disabled={currentPage === 1}
        onClick={() => setCurrentPage(currentPage - 1)}
    >
        Previous
    </button>

    <span>
        Page {currentPage} of {totalPages || 1}
    </span>

    <button
        disabled={currentPage === totalPages || totalPages === 0}
        onClick={() => setCurrentPage(currentPage + 1)}
    >
        Next
    </button>

</div>
<CategoryModal
    show={showModal}
    onClose={() => {
        setShowModal(false);
        setSelectedCategory(null);
        setIsEditMode(false);
    }}
    onSave={handleSaveCategory}
    category={selectedCategory}
    isEditMode={isEditMode}
/>


                   
<DeleteCategoryModal
    show={showDeleteModal}
    category={deleteCategory}
    onClose={() => {
        setShowDeleteModal(false);
        setDeleteCategory(null);
    }}
    onConfirm={confirmDelete}
/>

                </div>

            </div>

        </div>

    );

}

export default Categories;