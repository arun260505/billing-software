import React, { useState } from "react";
import "../../styles/pages/SuperAdmin/Dashboard.css";
import { useEffect } from "react";


import superAdminService from "../../services/superAdminService";

function Dashboard() {

    const [adminData, setAdminData] = useState({
        fullName: "",
        username: "",
        password: ""
    });

    const [admins, setAdmins] = useState([]);

    const handleChange = (e) => {

        const { name, value } = e.target;

        setAdminData({
            ...adminData,
            [name]: value
        });

    };
    useEffect(() => {

    loadAdmins();

}, []);

   const handleCreateAdmin = async (e) => {

    e.preventDefault();

    try {

        const response =
            await superAdminService.createAdmin(adminData);

        alert(response.message);

        setAdminData({
            fullName: "",
            username: "",
            password: ""
        });

        loadAdmins();

    }

    catch (error) {

        alert(
            error.response.data.message
        );

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

                        <h3>02</h3>

                        <p>Total Admins</p>

                    </div>

                    <div className="stat-card">

                        <h3>02</h3>

                        <p>Active Admins</p>

                    </div>

                    <div className="stat-card">

                        <h3>00</h3>

                        <p>Inactive Admins</p>

                    </div>

                </div>

                <div className="form-table-container">

                    <div className="create-admin-card">

                        <h2>Create Admin</h2>

                        <form onSubmit={handleCreateAdmin}>

                            <input
                                type="text"
                                name="fullName"
                                placeholder="Full Name"
                                value={adminData.fullName}
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

                                    <tr key={admin.id}>

                                        <td>{admin.id}</td>

                                        <td>{admin.fullName}</td>

                                        <td>{admin.username}</td>

                                        <td>

                                            <span className="status-active">

                                                {admin.status}

                                            </span>

                                        </td>

                                        <td>

                                            <button className="edit-btn">

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