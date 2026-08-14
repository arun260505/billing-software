import React, { useEffect, useState } from "react";
import AdminLayout from "../../layouts/AdminLayout";
import MenuModal from "../../components/Admin/MenuModal";
import DeleteModal from "../../components/Admin/DeleteModal";

import menuService from "../../services/menuService";

import "../../styles/Admin/Dashboard.css";
import "../../styles/Admin/Menu.css";

function Menu() {

    // ===========================
    // State
    // ===========================

    const [menuItems, setMenuItems] = useState([]);
    const [summary, setSummary] = useState({});
    const [categories, setCategories] = useState([]);

    const [loading, setLoading] = useState(false);

    const [search, setSearch] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [showDelete, setShowDelete] = useState(false);

    const [selectedItem, setSelectedItem] = useState(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // ===========================
    // Load Data
    // ===========================

    useEffect(() => {

        loadMenuItems();
        loadSummary();
        loadCategories();

    }, []);

    const loadMenuItems = async () => {

        try {

            setLoading(true);

            const data = await menuService.getMenuItems();

            setMenuItems(data.data || []);

        } catch (err) {

            console.error(err);

        } finally {

            setLoading(false);

        }

    };

    const loadSummary = async () => {

        try {

            const data = await menuService.getSummary();

            setSummary(data.data);

        } catch (err) {

            console.error(err);

        }

    };

    const loadCategories = async () => {

        try {

            const data = await menuService.getCategories();

            setCategories(
                data.filter(c => c.status === "Active")
            );

        } catch (err) {

            console.error(err);

        }

    };

    // ===========================
    // Modal Functions
    // ===========================

    const handleAdd = () => {

        setSelectedItem(null);

        setShowModal(true);

    };

    const handleEdit = (item) => {

        setSelectedItem(item);

        setShowModal(true);

    };

    const handleDeleteClick = (item) => {

        setSelectedItem(item);

        setShowDelete(true);

    };

    // ===========================
    // Delete
    // ===========================

    const handleDelete = async () => {

        try {

            await menuService.deleteMenuItem(
                selectedItem.id
            );

            setShowDelete(false);

            setSelectedItem(null);

            loadMenuItems();

            loadSummary();

        } catch (err) {

            console.error(err);

            alert("Unable to delete menu item.");

        }

    };

    // ===========================
    // Search
    // ===========================

    const filteredItems = menuItems.filter(item => {

        return (

            item.item_name
                .toLowerCase()
                .includes(search.toLowerCase())

            ||

            item.category_name
                .toLowerCase()
                .includes(search.toLowerCase())

        );

    });

    // ===========================
    // Pagination
    // ===========================

    const indexOfLastItem = currentPage * itemsPerPage;

    const indexOfFirstItem =
        indexOfLastItem - itemsPerPage;

    const currentItems =
        filteredItems.slice(
            indexOfFirstItem,
            indexOfLastItem
        );

    const totalPages =
        Math.ceil(
            filteredItems.length / itemsPerPage
        );
            // ===========================
    // JSX
    // ===========================

    return (

        <AdminLayout>

                <div className="dashboard-content">

                    <div className="page-header">

    <div className="page-title">

        <div className="title-icon">
            🍽
        </div>

        <div>

            <h2>Menu Management</h2>

            <p>
                Manage menu items, pricing and availability
            </p>

        </div>

    </div>

    <div className="page-actions">

        <button className="secondary-btn">
            Export
        </button>

        <button className="secondary-btn">
            Import
        </button>

        <button
            className="primary-btn"
            onClick={handleAdd}
        >
            + Add Menu Item
        </button>

    </div>

</div>
{/* ================= Summary Cards ================= */}

<div className="summary-grid">

    <div className="summary-card blue">

        <div className="summary-left">

            <div className="summary-icon">
                🍽
            </div>

            <div>

                <h5>Total Items</h5>

                <h2>{summary.totalItems || 0}</h2>

                <span>Menu Items</span>

            </div>

        </div>

    </div>

    <div className="summary-card green">

        <div className="summary-left">

            <div className="summary-icon">
                ✅
            </div>

            <div>

                <h5>Available</h5>

                <h2>{summary.availableItems || 0}</h2>

                <span>Ready to Order</span>

            </div>

        </div>

    </div>

    <div className="summary-card orange">

        <div className="summary-left">

            <div className="summary-icon">
                🔥
            </div>

            <div>

                <h5>Best Sellers</h5>

                <h2>{summary.bestSellerItems || 0}</h2>

                <span>Top Selling</span>

            </div>

        </div>

    </div>

    <div className="summary-card red">

        <div className="summary-left">

            <div className="summary-icon">
                ⭐
            </div>

            <div>

                <h5>Today's Special</h5>

                <h2>{summary.todaySpecialItems || 0}</h2>

                <span>Featured Items</span>

            </div>

        </div>

    </div>

</div>


                    {/* Search */}
{/* ================= Toolbar ================= */}

<div className="toolbar-card">

    <div className="search-box">

        <span className="search-icon">🔍</span>

        <input
            type="text"
            placeholder="Search by item name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
        />

    </div>

    <select className="toolbar-select">

        <option>All Categories</option>

        {categories.map(category => (

            <option
                key={category.id}
                value={category.id}
            >
                {category.category_name}
            </option>

        ))}

    </select>

    <select className="toolbar-select">

        <option>All Food Types</option>

        <option>Veg</option>

        <option>Non Veg</option>

        <option>Egg</option>

    </select>

    <select className="toolbar-select">

        <option>All Status</option>

        <option>Available</option>

        <option>Unavailable</option>

    </select>

</div>
                    
                    {/* Table */}

                    {/* ================= Menu Table ================= */}

<div className="table-card">

    <table className="menu-table">

        <thead>

            <tr>

                <th>Item</th>

                <th>Category</th>

                <th>Price</th>

                <th>Food Type</th>

                <th>Status</th>

                <th>Special</th>

                <th>Actions</th>

            </tr>

        </thead>

        <tbody>

            {loading ? (

                <tr>

                    <td colSpan="7" className="empty-cell">
                        Loading...
                    </td>

                </tr>

            ) : currentItems.length === 0 ? (

                <tr>

                    <td colSpan="7" className="empty-cell">

                        <div className="empty-state">

                            <div className="empty-icon">
                                🍽
                            </div>

                            <h3>No Menu Items</h3>

                            <p>

                                Start by adding your first menu item.

                            </p>

                            <button
                                className="primary-btn"
                                onClick={handleAdd}
                            >
                                + Add Menu Item
                            </button>

                        </div>

                    </td>

                </tr>

            ) : (

                currentItems.map(item => (

                    <tr key={item.id}>

                        <td>

                            <div className="item-cell">

                                <div className="item-image">

                                    🍜

                                </div>

                                <div>

                                    <strong>

                                        {item.item_name}

                                    </strong>

                                    <small>

                                        {item.item_code || "No Code"}

                                    </small>

                                </div>

                            </div>

                        </td>

                        <td>

                            {item.category_name}

                        </td>

                        <td>

                            ₹ {item.price}

                        </td>

                        <td>

                            <span
                                className={`food-badge ${
                                    item.food_type === "Veg"
                                        ? "veg"
                                        : item.food_type === "Non Veg"
                                        ? "nonveg"
                                        : "egg"
                                }`}
                            >

                                {item.food_type}

                            </span>

                        </td>

                        <td>

                            {item.available ? (

                                <span className="status available">

                                    Available

                                </span>

                            ) : (

                                <span className="status unavailable">

                                    Unavailable

                                </span>

                            )}

                        </td>

                        <td>

                            <div className="badge-group">

                                {item.is_best_seller === 1 && (

                                    <span className="badge best">

                                        🔥 Bestseller

                                    </span>

                                )}

                                {item.is_today_special === 1 && (

                                    <span className="badge special">

                                        ⭐ Special

                                    </span>

                                )}

                            </div>

                        </td>

                        <td>

                            <div className="action-buttons">

                                <button
                                    className="edit-btn"
                                    onClick={() =>
                                        handleEdit(item)
                                    }
                                >
                                    ✏
                                </button>

                                <button
                                    className="delete-btn"
                                    onClick={() =>
                                        handleDeleteClick(item)
                                    }
                                >
                                    🗑
                                </button>

                            </div>

                        </td>

                    </tr>

                ))

            )}

        </tbody>

    </table>

</div>                   {/* Pagination */}

                    {totalPages > 1 && (

                        <div className="pagination">

                            <button
                                disabled={currentPage === 1}
                                onClick={() =>
                                    setCurrentPage(currentPage - 1)
                                }
                            >
                                Previous
                            </button>

                            {[...Array(totalPages)].map((_, index) => (

                                <button
                                    key={index}
                                    className={
                                        currentPage === index + 1
                                            ? "active-page"
                                            : ""
                                    }
                                    onClick={() =>
                                        setCurrentPage(index + 1)
                                    }
                                >
                                    {index + 1}
                                </button>

                            ))}

                            <button
                                disabled={currentPage === totalPages}
                                onClick={() =>
                                    setCurrentPage(currentPage + 1)
                                }
                            >
                                Next
                            </button>

                        </div>

                    )}

                </div>

            {/* Menu Modal */}

            <MenuModal
                open={showModal}
                onClose={() => {

                    setShowModal(false);
                    setSelectedItem(null);

                }}
                onSave={() => {

                    loadMenuItems();
                    loadSummary();

                }}
                categories={categories}
                editItem={selectedItem}
                menuService={menuService}
            />

            {/* Delete Modal */}

            <DeleteModal
                open={showDelete}
                title="Delete Menu Item"
                message={
                    selectedItem
                        ? `Are you sure you want to delete "${selectedItem.item_name}"?`
                        : ""
                }
                onCancel={() => {

                    setShowDelete(false);
                    setSelectedItem(null);

                }}
                onDelete={handleDelete}
            />

        </AdminLayout>

    );

}

export default Menu;