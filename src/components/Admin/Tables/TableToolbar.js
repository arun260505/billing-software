import React from "react";
import { FaPlus, FaSearch, FaThLarge, FaList } from "react-icons/fa";

import "../../../styles/Admin/Tables/TableToolbar.css";

const TableToolbar = ({
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    view,
    setView,
    onAddTable
}) => {

    return (

        <div className="table-toolbar">

            <div className="toolbar-search">

                <FaSearch className="search-icon" />

                <input
                    type="text"
                    placeholder="Search table..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />

            </div>

            <div className="toolbar-actions">

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="All">All Status</option>
                    <option value="Available">Available</option>
                    <option value="Occupied">Occupied</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Billing">Billing</option>
                    <option value="Cleaning">Cleaning</option>
                </select>

                <div className="view-toggle">

                    <button
                        className={view === "grid" ? "active" : ""}
                        onClick={() => setView("grid")}
                    >
                        <FaThLarge />
                    </button>

                    <button
                        className={view === "list" ? "active" : ""}
                        onClick={() => setView("list")}
                    >
                        <FaList />
                    </button>

                </div>

                <button
                    className="add-table-btn"
                    onClick={onAddTable}
                >
                    <FaPlus />
                    Add Table
                </button>

            </div>

        </div>

    );

};

export default TableToolbar;