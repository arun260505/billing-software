import React, { useState, useEffect } from "react";
import { FaEdit, FaEllipsisV, FaCopy, FaPowerOff, FaTrash } from "react-icons/fa";

function ChargeTable({ charges, onEdit, onDuplicate, onToggleStatus, onDelete, sortField, sortDir, onSort }) {

    const [openMenu, setOpenMenu] = useState(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (!e.target.closest('.menu-btn') && !e.target.closest('.action-dropdown')) {
                setOpenMenu(null);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const formatDate = (dateStr) => {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHrs < 24) return `${diffHrs}h ago`;
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 30) return `${diffDays} days ago`;
        return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    };

    const formatAmount = (charge) => {
        const amt = Number(charge.amount);
        if (charge.charge_type === "Percentage") return `${amt}%`;
        return `₹${amt}`;
    };

    const getAppliesTags = (charge) => {
        const tags = [];
        if (charge.applies_dinein) tags.push(<span key="dinein" className="applies-tag dinein">Dine-in</span>);
        if (charge.applies_takeaway) tags.push(<span key="takeaway" className="applies-tag takeaway">Takeaway</span>);
        if (charge.applies_delivery) tags.push(<span key="delivery" className="applies-tag delivery">Delivery</span>);
        return tags.length > 0 ? tags : <span className="applies-tag">None</span>;
    };

    const renderSortArrow = (field) => {
        if (sortField !== field) return null;
        return <span className="sort-arrow">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>;
    };

    return (
        <div className="charges-table-card">
            <table className="charges-table">
                <thead>
                    <tr>
                        <th onClick={() => onSort("charge_name")}>
                            Charge Name {renderSortArrow("charge_name")}
                        </th>
                        <th>Type</th>
                        <th onClick={() => onSort("amount")}>
                            Amount {renderSortArrow("amount")}
                        </th>
                        <th>Applies To</th>
                        <th>Tax</th>
                        <th>Status</th>
                        <th onClick={() => onSort("updated_at")}>
                            Updated {renderSortArrow("updated_at")}
                        </th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {charges.length === 0 ? (
                        <tr>
                            <td colSpan="8">
                                <div className="charges-empty">
                                    <div className="empty-icon">📋</div>
                                    <h3>No Charges Found</h3>
                                    <p>Create your first billing charge to get started.</p>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        charges.map((charge) => (
                            <tr key={charge.id}>
                                <td>
                                    <div className="charge-name-cell">{charge.charge_name}</div>
                                    {charge.description && (
                                        <div className="charge-desc">{charge.description}</div>
                                    )}
                                </td>
                                <td>{charge.charge_type}</td>
                                <td style={{ fontWeight: 600 }}>{formatAmount(charge)}</td>
                                <td>
                                    <div className="applies-tags">
                                        {getAppliesTags(charge)}
                                    </div>
                                </td>
                                <td>
                                    <span className={charge.apply_tax ? "tax-yes" : "tax-no"}>
                                        {charge.apply_tax ? "Yes" : "No"}
                                    </span>
                                </td>
                                <td>
                                    <span className={`status-dot ${charge.status === "Active" ? "active" : "inactive"}`}>
                                        <span className="dot"></span>
                                        {charge.status}
                                    </span>
                                </td>
                                <td>{formatDate(charge.updated_at)}</td>
                                <td>
                                    <div className="charge-actions">
                                        <button className="edit-btn" onClick={() => onEdit(charge)} title="Edit">
                                            <FaEdit />
                                        </button>
                                        <div style={{ position: "relative" }}>
                                            <button
                                                className="menu-btn"
                                                onClick={() => setOpenMenu(openMenu === charge.id ? null : charge.id)}
                                                title="More actions"
                                            >
                                                <FaEllipsisV />
                                            </button>
                                            {openMenu === charge.id && (
                                                <div className="action-dropdown">
                                                    <button onClick={() => { onEdit(charge); setOpenMenu(null); }}>
                                                        <FaEdit /> Edit Charge
                                                    </button>
                                                    <button onClick={() => { onDuplicate(charge.id); setOpenMenu(null); }}>
                                                        <FaCopy /> Duplicate
                                                    </button>
                                                    <button onClick={() => { onToggleStatus(charge); setOpenMenu(null); }}>
                                                        <FaPowerOff /> {charge.status === "Active" ? "Deactivate" : "Activate"}
                                                    </button>
                                                    <button className="danger" onClick={() => { onDelete(charge); setOpenMenu(null); }}>
                                                        <FaTrash /> Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default ChargeTable;
