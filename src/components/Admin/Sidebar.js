import React from "react";
import { Link, useLocation } from "react-router-dom";
import { FaBars } from "react-icons/fa";
import { isSalon } from "../../utils/businessType";
import logo from "../../assets/inwallz-logo.png";
import "../../styles/Admin/Sidebar.css";

const RESTAURANT_MENUS = [
  { name: "Dashboard", path: "/admin/dashboard" },
  { name: "Restaurant", path: "/admin/restaurant" },
  { name: "Employees", path: "/admin/employees" },
  { name: "Menu", path: "/admin/menu" },
  { name: "Categories", path: "/admin/categories" },
  { name: "Tables", path: "/admin/tables" },
  { name: "Customers", path: "/admin/customers" },
  { name: "Orders", path: "/admin/orders" },
  { name: "Charges", path: "/admin/charges" },
  { name: "Billing", path: "/admin/billing" },
  { name: "Kitchen Template", path: "/admin/kitchen-template" },
  { name: "Reports", path: "/admin/reports" },
  { name: "Settings", path: "/admin/settings" }
];

// A salon owner's panel: no tables, menu or kitchen. Services are the salon's
// menu items, bills are its orders.
const SALON_MENUS = [
  { name: "Dashboard", path: "/admin/dashboard" },
  { name: "Services", path: "/admin/services" },
  { name: "Categories", path: "/admin/categories" },
  { name: "Customers", path: "/admin/customers" },
  { name: "Inventory", path: "/admin/inventory" },
  { name: "Employees", path: "/admin/employees" },
  { name: "Bills", path: "/admin/orders" },
  { name: "Charges", path: "/admin/charges" },
  { name: "Bill Format", path: "/admin/billing" },
  { name: "Reports", path: "/admin/reports" },
  { name: "Settings", path: "/admin/settings" }
];

function Sidebar({ isOpen, onToggle }) {
  const location = useLocation();

  const menus = isSalon() ? SALON_MENUS : RESTAURANT_MENUS;

  return (
    <div className={`sidebar ${isOpen ? "" : "collapsed"}`}>
      <div className="logo">
        <img src={logo} alt="InWallz" className="sidebar-logo" />
        <h2>InWallz POS</h2>
        {onToggle && (
          <button
            type="button"
            className="sidebar-collapse"
            onClick={onToggle}
            aria-label="Toggle menu"
          >
            <FaBars />
          </button>
        )}
      </div>

      <ul className="menu-list">
        {menus.map((menu) => (
          <li
            key={menu.path}
            className={location.pathname === menu.path ? "active" : ""}
          >
            {/* data-initial gives the collapsed rail something to show — it
                hides the label with font-size:0 and there are no icons. */}
            <Link to={menu.path} data-initial={menu.name.charAt(0)}>{menu.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Sidebar;
