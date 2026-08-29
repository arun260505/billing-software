import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus,
  FaClipboardList,
  FaUserPlus,
  FaUtensils,
  FaChartBar,
  FaArrowRight
} from "react-icons/fa";
import "../../styles/Admin/QuickActions.css";

const ACTIONS = [
  { label: "New Order", path: "/cashier", icon: <FaPlus />, primary: true },
  { label: "Manage Orders", path: "/admin/orders", icon: <FaClipboardList /> },
  { label: "Add Employee", path: "/admin/employees", icon: <FaUserPlus /> },
  { label: "Manage Menu", path: "/admin/menu", icon: <FaUtensils /> },
  { label: "View Reports", path: "/admin/reports", icon: <FaChartBar /> }
];

function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="ad-card ad-qa">
      <div className="ad-card-head">
        <div>
          <h3>Quick Actions</h3>
          <span className="ad-card-sub">Jump straight to work</span>
        </div>
      </div>

      <div className="ad-qa-grid">
        {ACTIONS.map((a) => (
          <button
            type="button"
            key={a.label}
            className={`ad-qa-btn${a.primary ? " primary" : ""}`}
            onClick={() => navigate(a.path)}
          >
            <span className="ad-qa-icon">{a.icon}</span>
            <span className="ad-qa-label">{a.label}</span>
            <span className="ad-qa-arrow"><FaArrowRight /></span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default QuickActions;