import React from "react";
import "../../styles/Admin/DashboardCard.css";

function DashboardCard({
  title,
  value,
  icon,
  color,
  growth,
}) {
  return (
    <div className="dashboard-card">
      <div
        className="card-icon"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>

      <div className="card-details">
        <h4>{title}</h4>
        <h2>{value}</h2>

        <span className="growth">
          {growth}
        </span>
      </div>
    </div>
  );
}

export default DashboardCard;