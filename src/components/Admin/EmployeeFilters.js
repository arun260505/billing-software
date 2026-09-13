import React from "react";
import { isSalon } from "../../utils/businessType";

// The search box and both dropdowns were uncontrolled and had no handlers, so
// typing or choosing anything did nothing at all.
function EmployeeFilters({ onAdd, search, role, status, onChange }) {

    const salon = isSalon();

    return (

        <div className="employee-filters">

            <input
                type="text"
                placeholder="🔍 Search Employee..."
                value={search}
                onChange={(e) => onChange("search", e.target.value)}
            />

            <select value={role} onChange={(e) => onChange("role", e.target.value)}>
                <option value="">All Roles</option>
                {salon ? (
                    <>
                        <option value="admin">Owner</option>
                        <option value="cashier">Receptionist</option>
                        <option value="stylist">Stylist</option>
                    </>
                ) : (
                    <>
                        <option value="admin">Admin</option>
                        <option value="cashier">Cashier</option>
                        <option value="waiter">Waiter</option>
                        <option value="kitchen">Kitchen</option>
                    </>
                )}
            </select>

            <select value={status} onChange={(e) => onChange("status", e.target.value)}>
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
            </select>

            <button
                type="button"
                className="add-btn"
                onClick={onAdd}
            >
                + Add Employee
            </button>

        </div>

    );

}

export default EmployeeFilters;