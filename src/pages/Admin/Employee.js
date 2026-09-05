import React, { useEffect, useState } from "react";
import EmployeeModal from "../../components/Admin/EmployeeModal";

import AdminLayout from "../../layouts/AdminLayout";

import EmployeeCards from "../../components/Admin/EmployeeCards";
import EmployeeFilters from "../../components/Admin/EmployeeFilters";
import EmployeeTable from "../../components/Admin/EmployeeTable";

import employeeService from "../../services/employeeService";
import EmployeeSuccessModal from "../../components/Admin/EmployeeSuccessModal";

import "../../styles/Admin/Dashboard.css";
import "../../styles/Admin/Employee.css";

function Employee() {


    const [employees, setEmployees] = useState([]);
    const [summary, setSummary] = useState({});
    const [showModal, setShowModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
const [credentials, setCredentials] = useState(null);

// The employee being edited (null = the Add form), and the live filter state
// the search box and dropdowns feed.
const [editing, setEditing] = useState(null);
const [filters, setFilters] = useState({ search: "", role: "", status: "" });

const changeFilter = (field, value) =>
    setFilters((prev) => ({ ...prev, [field]: value }));

// Filtering happens here rather than on the server: the staff list is a handful
// of rows per restaurant, so a round trip per keystroke would be wasteful.
const visibleEmployees = employees.filter((e) => {
    const term = filters.search.trim().toLowerCase();
    const matchesTerm =
        !term ||
        String(e.full_name || "").toLowerCase().includes(term) ||
        String(e.username || "").toLowerCase().includes(term) ||
        String(e.mobile || "").includes(term);
    const matchesRole = !filters.role || e.role === filters.role;
    const matchesStatus = !filters.status || e.status === filters.status;
    return matchesTerm && matchesRole && matchesStatus;
});

    useEffect(() => {

        loadEmployees();
        loadSummary();

    }, []);

    const loadEmployees = () => {

        employeeService.getEmployees()

            .then((res) => {

                setEmployees(res.data.data);
            


            })

            .catch((err) => {

                console.log(err);

            });

    };
  const handleAddEmployee = async (form) => {

    try {

        const response = await employeeService.addEmployee(form);

        setCredentials({
            full_name: form.full_name,
            username: response.data.data.username,
            password: response.data.data.password
        });

        setShowModal(false);

        setShowSuccessModal(true);

        loadEmployees();

        loadSummary();

    } catch (err) {

        console.error(err);

        alert("Failed to create employee.");

    }

};

const handleEditEmployee = async (form) => {

    try {
        await employeeService.updateEmployee(editing.id, form);
        setEditing(null);
        setShowModal(false);
        loadEmployees();
        loadSummary();
    } catch (err) {
        alert(
            err.response?.data?.message ||
            err.friendlyMessage ||
            "Could not update the employee."
        );
    }

};

const handleDeleteEmployee = async (employee) => {

    if (!window.confirm(
        `Remove ${employee.full_name}?\n\nThey will no longer be able to log in. ` +
        `Their past orders stay on record.`
    )) return;

    try {
        await employeeService.deleteEmployee(employee.id);
        loadEmployees();
        loadSummary();
    } catch (err) {
        alert(
            err.response?.data?.message ||
            err.friendlyMessage ||
            "Could not remove the employee."
        );
    }

};

const handleViewEmployee = (employee) => {
    alert(
        `${employee.full_name}\n\n` +
        `Username : ${employee.username}\n` +
        `Role     : ${employee.role}\n` +
        `Mobile   : ${employee.mobile || "—"}\n` +
        `Email    : ${employee.email || "—"}\n` +
        `Status   : ${employee.status}\n` +
        `Added    : ${new Date(employee.created_at).toLocaleString()}`
    );
};

    const loadSummary = () => {

        employeeService.getSummary()

            .then((res) => {

                setSummary(res.data.data);
               

            })

            .catch((err) => {

                console.log(err);

            });

    };

    return (

    <AdminLayout>

        <div className="dashboard-content">

                    <div className="page-header">

                        <h2>Employee Management</h2>

                        <p>Manage restaurant employees efficiently.</p>

                    </div>
                    <EmployeeCards summary={summary} />

<EmployeeFilters
    onAdd={() => { setEditing(null); setShowModal(true); }}
    search={filters.search}
    role={filters.role}
    status={filters.status}
    onChange={changeFilter}
/>

<EmployeeTable
    employees={visibleEmployees}
    onView={handleViewEmployee}
    onEdit={(employee) => { setEditing(employee); setShowModal(true); }}
    onDelete={handleDeleteEmployee}
/>

<EmployeeModal
    show={showModal}
    editEmployee={editing}
    onClose={() => { setShowModal(false); setEditing(null); }}
    onSave={editing ? handleEditEmployee : handleAddEmployee}
/>
<EmployeeSuccessModal
    show={showSuccessModal}
    credentials={credentials}
    onClose={() => setShowSuccessModal(false)}
/>


                </div>

    </AdminLayout>

);

}
export default Employee;