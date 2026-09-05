import React, { useEffect, useState } from "react";
import AdminLayout from "../../layouts/AdminLayout";
import MenuModal from "../../components/Admin/MenuModal";
import DeleteModal from "../../components/Admin/DeleteModal";

import menuService from "../../services/menuService";
import categoryService from "../../services/categoryService";

import "../../styles/Admin/Dashboard.css";
import "../../styles/Admin/Menu.css";

function Menu() {

    // ===========================
    // State
    // ===========================

    const [menuItems, setMenuItems] = useState([]);
    const [summary, setSummary] = useState({});
    const [categories, setCategories] = useState([]);

    // Which category sections are expanded on the menu (click to open/close).
    const [openCats, setOpenCats] = useState([]);
    const toggleCat = (name) =>
        setOpenCats((prev) =>
            prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
        );

    // Inline timing editor: which category row is being edited and its draft times.
    const [timingEditCat, setTimingEditCat] = useState(null);
    const [timingForm, setTimingForm] = useState({
        start_time: "",
        end_time: ""
    });

    const openTimingEditor = (catName, startTime, endTime) => {
        setTimingForm({
            start_time: startTime ? startTime.slice(0, 5) : "",
            end_time: endTime ? endTime.slice(0, 5) : ""
        });
        setTimingEditCat(catName);
    };

    const closeTimingEditor = () => {
        setTimingEditCat(null);
        setTimingForm({ start_time: "", end_time: "" });
    };

    const saveCategoryTiming = async (categoryId, catName) => {

        if (
            (timingForm.start_time && !timingForm.end_time) ||
            (!timingForm.start_time && timingForm.end_time)
        ) {
            alert("Please set both start time and end time, or clear both.");
            return;
        }

        try {

            await categoryService.updateCategoryTiming(categoryId, {
                start_time: timingForm.start_time || null,
                end_time: timingForm.end_time || null
            });

            closeTimingEditor();
            loadMenuItems();

        } catch (err) {

            console.error(err);
            alert("Unable to update category timing.");

        }

    };

    const [loading, setLoading] = useState(false);

    const [search, setSearch] = useState("");

    // Toolbar filters. "" means "all" for each.
    const [categoryFilter, setCategoryFilter] = useState("");
    const [foodTypeFilter, setFoodTypeFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [showDelete, setShowDelete] = useState(false);

    const [selectedItem, setSelectedItem] = useState(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const formatClockTime = (time) => {
        const [h, m] = time.slice(0, 5).split(":");
        const hour = Number(h);
        const ampm = hour >= 12 ? "PM" : "AM";
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${m} ${ampm}`;
    };

    const formatTiming = (startTime, endTime) => {
        if (!startTime || !endTime) {
            return "All Day";
        }

        return `${formatClockTime(startTime)} - ${formatClockTime(endTime)}`;
    };

    // Checks current time against a category's start/end (supports overnight windows).
    const isWithinTiming = (startTime, endTime) => {
        if (!startTime || !endTime || startTime === endTime) {
            return true;
        }

        const toMinutes = (t) => {
            const [h, m] = t.slice(0, 5).split(":").map(Number);
            return h * 60 + m;
        };

        const now = new Date();
        const current = now.getHours() * 60 + now.getMinutes();
        const start = toMinutes(startTime);
        const end = toMinutes(endTime);

        return start < end
            ? current >= start && current <= end
            : current >= start || current <= end;
    };

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

    // Manual per-item availability toggle (overrides category timing).
    // Updates the row in place — no table reload, no flicker.
    const handleToggleAvailability = async (item) => {

        const newAvailable = !item.available;
        const newEffective = newAvailable
            ? item.is_category_timing_active
            : 0;

        const patchRow = (available, effective) =>
            setMenuItems((prev) =>
                prev.map((i) =>
                    i.id === item.id
                        ? {
                              ...i,
                              available: available ? 1 : 0,
                              effective_available: effective
                          }
                        : i
                )
            );

        patchRow(newAvailable, newEffective);

        try {

            await menuService.setAvailability(item.id, newAvailable);

            loadSummary();

        } catch (err) {

            console.error(err);

            patchRow(!newAvailable, item.effective_available);

            alert("Unable to update item availability.");

        }

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

        const term = search.toLowerCase();

        const matchesSearch =
            !term ||
            String(item.item_name || "").toLowerCase().includes(term) ||
            String(item.category_name || "").toLowerCase().includes(term);

        const matchesCategory =
            !categoryFilter || String(item.category_id) === String(categoryFilter);

        // The column stores "NonVeg"; older rows may carry "Non Veg".
        const matchesFoodType =
            !foodTypeFilter ||
            String(item.food_type || "").replace(/\s+/g, "").toLowerCase() ===
                foodTypeFilter.replace(/\s+/g, "").toLowerCase();

        // `available` is a tinyint; 0 means the item is switched off.
        const matchesStatus =
            !statusFilter ||
            (statusFilter === "available"
                ? Number(item.available) !== 0
                : Number(item.available) === 0);

        return matchesSearch && matchesCategory && matchesFoodType && matchesStatus;

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

    {/* All three dropdowns were uncontrolled and had no onChange, so picking a
        category, food type or status did nothing at all. */}
    <select
        className="toolbar-select"
        value={categoryFilter}
        onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
    >

        <option value="">All Categories</option>

        {categories.map(category => (

            <option
                key={category.id}
                value={category.id}
            >
                {category.category_name}
            </option>

        ))}

    </select>

    <select
        className="toolbar-select"
        value={foodTypeFilter}
        onChange={(e) => { setFoodTypeFilter(e.target.value); setCurrentPage(1); }}
    >

        <option value="">All Food Types</option>

        <option value="Veg">Veg</option>

        <option value="NonVeg">Non Veg</option>

        <option value="Egg">Egg</option>

    </select>

    <select
        className="toolbar-select"
        value={statusFilter}
        onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
    >

        <option value="">All Status</option>

        <option value="available">Available</option>

        <option value="unavailable">Unavailable</option>

    </select>

</div>
                    
                    {/* Table */}

                    {/* ================= Menu Table ================= */}

<div className="menu-table-card">

    <table className="menu-table">

        <thead>

            <tr>

                <th>Item</th>

                <th>Category</th>

                <th>Price</th>

                <th>Food Type</th>

                <th>Timing</th>

                <th>Status</th>

                <th>Special</th>

                <th>Actions</th>

            </tr>

        </thead>

        <tbody>

            {loading ? (

                <tr>

                    <td colSpan="8" className="empty-cell">
                        Loading...
                    </td>

                </tr>

            ) : currentItems.length === 0 ? (

                <tr>

                    <td colSpan="8" className="empty-cell">

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

                Object.entries(
                    filteredItems.reduce((groups, item) => {
                        const key = item.category_name || "Uncategorized";
                        (groups[key] = groups[key] || []).push(item);
                        return groups;
                    }, {})
                ).map(([catName, catItems]) => {

                    // All items in a group share their category's timing.
                    const catStart = catItems[0].start_time;
                    const catEnd = catItems[0].end_time;
                    const timingOpen = isWithinTiming(catStart, catEnd);

                    return (

                    <React.Fragment key={catName}>

                        <tr
                            className="cat-header-row"
                            onClick={() => toggleCat(catName)}
                        >
                            <td colSpan="8">
                                <span className="cat-toggle">
                                    {openCats.includes(catName) ? "▾" : "▸"}
                                </span>
                                <span className="cat-name">{catName}</span>
                                <span className="cat-count">
                                    {catItems.length} item{catItems.length !== 1 ? "s" : ""}
                                </span>
                                <span
                                    className={`cat-timing ${timingOpen ? "" : "closed"}`}
                                    title="Click to set timing for all items"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openTimingEditor(catName, catStart, catEnd);
                                    }}
                                >
                                    🕒 {formatTiming(catStart, catEnd)}
                                </span>
                                {!timingOpen && (
                                    <span className="cat-timing-note">
                                        Closed now
                                    </span>
                                )}
                                {timingEditCat === catName && (
                                    <span
                                        className="cat-timing-editor"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="time"
                                            value={timingForm.start_time}
                                            onChange={(e) =>
                                                setTimingForm({
                                                    ...timingForm,
                                                    start_time: e.target.value
                                                })
                                            }
                                        />
                                        <span className="editor-sep">to</span>
                                        <input
                                            type="time"
                                            value={timingForm.end_time}
                                            onChange={(e) =>
                                                setTimingForm({
                                                    ...timingForm,
                                                    end_time: e.target.value
                                                })
                                            }
                                        />
                                        <button
                                            className="editor-save"
                                            onClick={() =>
                                                saveCategoryTiming(
                                                    catItems[0].category_id,
                                                    catName
                                                )
                                            }
                                        >
                                            Save
                                        </button>
                                        <button
                                            className="editor-cancel"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                closeTimingEditor();
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </span>
                                )}
                            </td>
                        </tr>

                        {openCats.includes(catName) && catItems.map(item => (

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

                            {/* Always two decimals — the raw column value renders
                                as "150" for one item and "149.50" for the next. */}
                            ₹ {Number(item.price).toFixed(2)}

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

                            <div className="timing-cell">

                                <span className="timing-range">
                                    {formatTiming(
                                        item.start_time,
                                        item.end_time
                                    )}
                                </span>

                                {item.start_time &&
                                    item.end_time &&
                                    !item.is_category_timing_active && (
                                        <small className="timing-note">
                                            Outside timing
                                        </small>
                                    )}

                            </div>

                        </td>

                        <td>

                            <div className="status-cell">

                                <label className="toggle-switch" title="Toggle item availability">
                                    <input
                                        type="checkbox"
                                        checked={!!item.available}
                                        onChange={() =>
                                            handleToggleAvailability(item)
                                        }
                                    />
                                    <span className="toggle-slider" />
                                </label>

                                {item.effective_available ? (

                                    <span className="status available">

                                        Available

                                    </span>

                                ) : item.available ? (

                                    <span className="status unavailable">

                                        Timing Off

                                    </span>

                                ) : (

                                    <span className="status unavailable">

                                        Unavailable

                                    </span>

                                )}

                            </div>

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

                         ))}

                    </React.Fragment>

                    );

                })

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
