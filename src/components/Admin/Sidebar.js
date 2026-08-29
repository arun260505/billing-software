import React from "react";
import { Link, useLocation } from "react-router-dom";
import "../../styles/Admin/Sidebar.css";

function Sidebar({ isOpen }) {
  const location = useLocation();

  const menus = [
    { name: "Dashboard", path: "/admin/dashboard" },
    { name: "Restaurant", path: "/admin/restaurant" },
    { name: "Employees", path: "/admin/employees" },
    { name: "Menu", path: "/admin/menu" },
    { name: "Categories", path: "/admin/categories" },
    { name: "Tables", path: "/admin/tables" },
    { name: "Customers", path: "/admin/customers" },
    { name: "Orders", path: "/admin/orders" },
    { name: "Charges & Settings", path: "/admin/charges" },
    { name: "Billing", path: "/admin/billing" },
    { name: "Kitchen Template", path: "/admin/kitchen-template" },
    { name: "Reports", path: "/admin/reports" },
    { name: "Settings", path: "/admin/settings" }
  ];

  return (
    <div className={`sidebar ${isOpen ? "" : "collapsed"}`}>
      <div className="logo">
        <h2>InWallz POS</h2>
      </div>

      <ul className="menu-list">
        {menus.map((menu) => (
          <li
            key={menu.path}
            className={location.pathname === menu.path ? "active" : ""}
          >
            <Link to={menu.path}>{menu.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Sidebar;