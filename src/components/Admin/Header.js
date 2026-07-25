import React from "react";
import "../../styles/Admin/Header.css";

function Header() {
  return (
    <header className="admin-header">
      <div className="header-left">
        <h2>Admin Dashboard</h2>
        <p>Welcome back!</p>
      </div>

      <div className="header-right">
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