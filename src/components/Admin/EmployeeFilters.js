import React from "react";

function EmployeeFilters({ onAdd }) {

    return (

        <div className="employee-filters">

            <input
                type="text"
                placeholder="🔍 Search Employee..."
            />

            <select>
                <option>All Roles</option>
                <option value="admin">Admin</option>
                <option value="cashier">Cashier</option>
                <option value="waiter">Waiter</option>
                <option value="kitchen">Kitchen</option>
            </select>

            <select>
                <option>All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
            </select>

            <button
                type="button"
                className="add-btn"
                onClick={() => {
                    console.log("Button clicked");
                    onAdd();
                }}
            >
                + Add Employee
            </button>

        </div>

    );

}

export default EmployeeFilters;