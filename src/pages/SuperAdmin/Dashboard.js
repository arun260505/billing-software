import React, { useState } from "react";
import "../../styles/pages/SuperAdmin/Dashboard.css";
import { useEffect } from "react";


import superAdminService from "../../services/superAdminService";

function Dashboard() {

    const [adminData, setAdminData] = useState({
        restaurantName: "",
        fullName: "",
        mobile: "",
        username: "",
        password: ""
    });

    const [admins, setAdmins] = useState([]);

    // The admin currently open in the edit row, or null.
    const [editing, setEditing] = useState(null);
    const [savingEdit, setSavingEdit] = useState(false);

    const handleChange = (e) => {

        const { name, value } = e.target;

        // Stop the wrong characters at the keyboard rather than only complaining
        // on submit: digits only in the mobile box, and no digits in a name.
        const cleaned =
            name === "mobile"   ? value.replace(/[^0-9]/g, "").slice(0, 10) :
            name === "fullName" ? value.replace(/[0-9]/g, "") :
            value;

        setAdminData({
            ...adminData,
            [name]: cleaned
        });

    };
    useEffect(() => {

    loadAdmins();

}, []);

// A mobile number is ten digits. A person's name is not a number. The form
// accepted letters in the mobile field and digits in the owner name, and both
// went straight to the database.
const MOBILE_RE = /^[0-9]{10}$/;
const NAME_RE = /^[A-Za-z][A-Za-z .'-]*$/;

// Returns the first problem with the form, or "" when it is good to send.
function validateAdmin(data, { requirePassword = true } = {}) {

    if (!String(data.restaurantName || "").trim()) return "Restaurant name is required.";

    const name = String(data.fullName || "").trim();
    if (!name) return "Owner / admin name is required.";
    if (!NAME_RE.test(name)) return "Owner name cannot contain numbers or symbols.";

    if (!MOBILE_RE.test(String(data.mobile || "").trim())) {
        return "Mobile number must be exactly 10 digits.";
    }

    if (!String(data.username || "").trim()) return "Username is required.";

    if (requirePassword && String(data.password || "").length < 8) {
        return "Password must be at least 8 characters.";
    }

    return "";
}

   const handleCreateAdmin = async (e) => {

    e.preventDefault();

    const problem = validateAdmin(adminData);
    if (problem) {
        alert(problem);
        return;
    }

    try {

        const response =
            await superAdminService.createAdmin(adminData);

        alert(response.message);

        setAdminData({
            restaurantName: "",
            fullName: "",
            mobile: "",
            username: "",
            password: ""
        });

        loadAdmins();

    }

    catch (error) {

    alert(
        error.response?.data?.message ||
        "Failed to create admin. Please try again."
    );

}

};
// Open the inline editor for one admin. The Edit button used to do nothing at
// all — there was no handler on it and no endpoint behind it.
const startEdit = (admin) => {
    setEditing({
        id: admin.id,
        full_name: admin.full_name || "",
        mobile: admin.mobile || "",
        status: admin.status || "Active"
    });
};

const changeEdit = (field, value) => {
    const cleaned =
        field === "mobile"    ? value.replace(/[^0-9]/g, "").slice(0, 10) :
        field === "full_name" ? value.replace(/[0-9]/g, "") :
        value;
    setEditing((prev) => ({ ...prev, [field]: cleaned }));
};

const saveEdit = async () => {

    const name = editing.full_name.trim();
    if (!name)               { alert("Owner / admin name is required."); return; }
    if (!NAME_RE.test(name)) { alert("Owner name cannot contain numbers or symbols."); return; }
    if (editing.mobile && !MOBILE_RE.test(editing.mobile)) {
        alert("Mobile number must be exactly 10 digits.");
        return;
    }

    setSavingEdit(true);
    try {
        const res = await superAdminService.updateAdmin(editing.id, {
            full_name: name,
            mobile: editing.mobile,
            status: editing.status
        });
        alert(res.message || "Admin updated.");
        setEditing(null);
        loadAdmins();
    } catch (error) {
        alert(
            error.response?.data?.message ||
            error.friendlyMessage ||
            "Could not update the admin."
        );
    } finally {
        setSavingEdit(false);
    }

};

const handleDelete = async (id) => {

    if (!window.confirm("Delete Admin?"))
        return;

    await superAdminService.deleteAdmin(id);

    loadAdmins();

};
    const loadAdmins = async () => {

    try {

        const response =
            await superAdminService.getAdmins();

        if (response.success) {

            setAdmins(response.admins);

        }

    }

    catch (error) {

        console.log(error);

    }

};


    const handleLogout = () => {

        localStorage.removeItem("token");
        localStorage.removeItem("user");

        window.location.href = "/";

    };

    return (

        <div className="super-admin-container">

            <header className="top-navbar">

                <div>

                    <h2>InWallz Billing Software</h2>

                    <span>Super Admin Panel</span>

                </div>

                <button
                    className="logout-btn"
                    onClick={handleLogout}
                >
                    Logout
                </button>

            </header>

            <div className="dashboard-body">

                <div className="dashboard-title">

                    <h1>Dashboard</h1>

                    <p>Manage Admin Accounts</p>

                </div>

                <div className="stats-container">

                    <div className="stat-card">

                        <h3>{admins.length}</h3>

<p>Total Admins</p>
                    </div>

                    <div className="stat-card">

                        <h3>
    {admins.filter((admin) => admin.status === "Active").length}
</h3>

<p>Active Admins</p>
                    </div>

                    <div className="stat-card">

                       <h3>
    {admins.filter((admin) => admin.status === "Inactive").length}
</h3>

<p>Inactive Admins</p>

                    </div>

                </div>

                <div className="form-table-container">

                    <div className="create-admin-card">

                        <h2>Create Admin</h2>

                        <form onSubmit={handleCreateAdmin}>

                            <input
                                type="text"
                                name="restaurantName"
                                placeholder="Restaurant Name"
                                value={adminData.restaurantName}
                                onChange={handleChange}
                                required
                            />

                            <input
                                type="text"
                                name="fullName"
                                placeholder="Owner / Admin Full Name"
                                value={adminData.fullName}
                                onChange={handleChange}
                                required
                            />

                            <input
                                type="text"
                                name="mobile"
                                placeholder="Mobile Number"
                                value={adminData.mobile}
                                onChange={handleChange}
                                required
                            />

                            <input
                                type="text"
                                name="username"
                                placeholder="Username"
                                value={adminData.username}
                                onChange={handleChange}
                                required
                            />

                            <input
                                type="password"
                                name="password"
                                placeholder="Password"
                                value={adminData.password}
                                onChange={handleChange}
                                required
                            />

                            <button type="submit">

                                Create Admin

                            </button>

                        </form>

                    </div>

                    <div className="admin-table-card">

                        <h2>Registered Admins</h2>

                        <table>

                            <thead>

                                <tr>

                                    <th>ID</th>
                                    <th>Full Name</th>
                                    <th>Username</th>
                                    <th>Status</th>
                                    <th>Action</th>

                                </tr>

                            </thead>

                            <tbody>

                                {admins.map((admin) => (

                                    editing && editing.id === admin.id ? (

                                        <tr key={admin.id} className="editing-row">

                                            <td data-label="ID">{admin.id}</td>

                                            <td data-label="Full Name">
                                                <input
                                                    className="edit-input"
                                                    value={editing.full_name}
                                                    onChange={(e) => changeEdit("full_name", e.target.value)}
                                                    placeholder="Owner name"
                                                    autoFocus
                                                />
                                                <input
                                                    className="edit-input"
                                                    value={editing.mobile}
                                                    onChange={(e) => changeEdit("mobile", e.target.value)}
                                                    placeholder="10-digit mobile"
                                                    inputMode="numeric"
                                                />
                                            </td>

                                            <td data-label="Username">{admin.username}</td>

                                            <td data-label="Status">
                                                <select
                                                    className="edit-input"
                                                    value={editing.status}
                                                    onChange={(e) => changeEdit("status", e.target.value)}
                                                >
                                                    <option>Active</option>
                                                    <option>Inactive</option>
                                                </select>
                                            </td>

                                            <td data-label="Action">
                                                <button
                                                    className="edit-btn"
                                                    onClick={saveEdit}
                                                    disabled={savingEdit}
                                                >
                                                    {savingEdit ? "Saving…" : "Save"}
                                                </button>
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => setEditing(null)}
                                                    disabled={savingEdit}
                                                >
                                                    Cancel
                                                </button>
                                            </td>

                                        </tr>

                                    ) : (

                                    <tr key={admin.id}>

                                        <td data-label="ID">{admin.id}</td>

                                        <td data-label="Full Name">{admin.full_name}</td>

                                        <td data-label="Username">{admin.username}</td>

                                        <td data-label="Status">

                                            <span className={admin.status === "Inactive" ? "status-inactive" : "status-active"}>

                                                {admin.status}

                                            </span>

                                        </td>

                                        <td data-label="Action">

                                            <button
                                                className="edit-btn"
                                                onClick={() => startEdit(admin)}
                                            >

                                                Edit

                                            </button>
<button
    className="delete-btn"
    onClick={() => handleDelete(admin.id)}
>
    Delete
</button>

                                        </td>

                                    </tr>

                                    )
                                ))}

                            </tbody>

                        </table>

                    </div>

                </div>

            </div>

        </div>

    );

}

export default Dashboard;