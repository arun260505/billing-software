import React from "react";
import { FaSearch, FaPlus } from "react-icons/fa";

function CategoryFilters({
    search,
    onSearch,
    statusFilter,
    onStatusChange,
    onAdd
}) {
    return (
        <div className="category-filters">

            <div className="search-box">
                <FaSearch className="search-icon" />

                <input
                    type="text"
                    placeholder="Search categories..."
                    value={search}
                    onChange={(e) => onSearch(e.target.value)}
                />
            </div>

            <select
                className="status-filter"
                value={statusFilter}
                onChange={(e) => onStatusChange(e.target.value)}
            >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
            </select>

            <button
                className="add-category-btn"
                onClick={onAdd}
            >
                <FaPlus />
                <span>Add Category</span>
            </button>

        </div>
    );
}

export default CategoryFilters;