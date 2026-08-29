import React from "react";
import {
  FaRupeeSign,
  FaClipboardList,
  FaMoneyBillWave,
  FaUtensils,
  FaStore,
  FaChartLine,
  FaBoxOpen
} from "react-icons/fa";
import "../../styles/Admin/DashboardCard.css";

const ICONS = {
  FaRupeeSign,
  FaClipboardList,
  FaMoneyBillWave,
  FaUtensils,
  FaStore,
  FaChartLine,
  FaBoxOpen
};

function DashboardCard({ title, value, sub, icon = "FaChartLine", accent = "#2563EB" }) {
  const Icon = ICONS[icon] || FaChartLine;

  return (
    <div
      className="dashboard-card"
      style={{ "--accent": accent }}
    >
      <div className="card-icon-chip">
        <Icon />
      </div>

      <div className="card-details">
        <h4>{title}</h4>
        <h2>{value}</h2>
        {sub && <span className="card-sub">{sub}</span>}
      </div>

      <span className="card-accent-bar" />
    </div>
  );
}

export default DashboardCard;