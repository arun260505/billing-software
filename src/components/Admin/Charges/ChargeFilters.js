import React from "react";
import { FaSearch, FaPlus, FaRedo } from "react-icons/fa";

function ChargeFilters({
    search,
    onSearch,
    typeFilter,
    onTypeChange,
    appliesFilter,
    onAppliesChange,
    statusFilter,
    onStatusChange,
    onReset,
    onAdd
}) {
    return (
        <div className="charges-toolbar">
            <div className="search-box">
                <FaSearch className="search-icon" />
                <input
                    type="text"
                    placeholder="Search charges..."
                    value={search}
                    onChange={(e) => onSearch(e.target.value)}
                />
            </div>

            <select
                className="filter-select"
                value={typeFilter}
                onChange={(e) => onTypeChange(e.target.value)}
            >
                <option value="All">Charge Type: All</option>
                <option value="Fixed">Fixed</option>
                <option value="Percentage">Percentage</option>
                <option value="Per Item">Per Item</option>
                <option value="Per Person">Per Person</option>
                <option value="Per Table">Per Table</option>
                <option value="Per Hour">Per Hour</option>
            </select>

            <select
                className="filter-select"
                value={appliesFilter}
                onChange={(e) => onAppliesChange(e.target.value)}
            >
                <option value="All">Applies To: All</option>
                <option value="Dine-in">Dine-in</option>
                <option value="Takeaway">Takeaway</option>
                <option value="Delivery">Delivery</option>
            </select>

            <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => onStatusChange(e.target.value)}
            >
                <option value="All">Status: All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
            </select>

            <button className="reset-btn" onClick={onReset}>
                <FaRedo style={{ marginRight: 4, fontSize: 11 }} />
                Reset
            </button>

            <button className="primary-btn" onClick={onAdd}>
                <FaPlus /> Add Charge
            </button>
        </div>
    );
}

export default ChargeFilters;
