import React from "react";
import { FaSignOutAlt } from "react-icons/fa";
import "../../styles/Admin/Header.css";

function Header() {

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/";
    };

    return (
        <header className="admin-header">
            <div className="header-left">
                <h2>Admin Dashboard</h2>
                <p>Welcome back!</p>
            </div>

            <div className="header-right">
                <button className="logout-btn" onClick={handleLogout}>
                    <FaSignOutAlt />
                    <span>Logout</span>
                </button>

                <div className="admin-profile">
                    <div className="profile-image">
                        A
                    </div>

                    <div className="profile-info">
                        <h4>Admin</h4>
                        <span>Restaurant Admin</span>
                    </div>
                </div>
            </div>
        </header>
    );
}

export default Header;
