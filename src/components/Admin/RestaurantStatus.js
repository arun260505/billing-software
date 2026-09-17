import React from "react";
import {
  FaChair,
  FaFire,
  FaReceipt,
  FaSyncAlt
} from "react-icons/fa";
import "../../styles/Admin/RestaurantStatus.css";

function RestaurantStatus({ summary = {}, loading = false }) {

  if (loading) {
    return (
      <div className="ad-card ad-status">
        <div className="ad-card-head">
          <h3>Restaurant Status</h3>
        </div>
        <div className="ad-skel-lines">
          <span className="ad-skel ad-skel-line" />
          <span className="ad-skel ad-skel-line" />
          <span className="ad-skel ad-skel-line" />
          <span className="ad-skel ad-skel-line" />
        </div>
      </div>
    );
  }

  const occupied = Number(summary.occupied_tables || 0);
  const totalTables = Number(summary.total_tables || 0);
  const kitchen = Number(summary.kitchen_orders || 0);
  const pendingBills = Number(summary.pending_bills || 0);

  const occupancyRatio = totalTables > 0 ? occupied / totalTables : 0;

  const rows = [
    {
      icon: <FaChair />,
      label: "Tables",
      value: `${occupied} / ${totalTables} occupied`,
      tone: occupancyRatio >= 0.8 ? "warn" : "good"
    },
    {
      icon: <FaFire />,
      label: "Kitchen Orders",
      value: kitchen,
      tone: kitchen > 6 ? "warn" : kitchen > 0 ? "info" : "good"
    },
    {
      icon: <FaReceipt />,
      label: "Pending Bills",
      value: pendingBills,
      tone: pendingBills > 6 ? "warn" : pendingBills > 0 ? "info" : "good"
    },
    {
      icon: <FaSyncAlt />,
      label: "Pending Sync",
      value: Number(summary.pending_sync || 0),
      tone: Number(summary.pending_sync || 0) > 0 ? "warn" : "good"
    }
  ];

  return (
    <div className="ad-card ad-status">
      <div className="ad-card-head">
        <h3>Restaurant Status</h3>
        <span className="ad-card-sub">Live operational overview</span>
      </div>

      <div className="ad-status-rows">
        {rows.map((row) => (
          <div className="ad-status-row" key={row.label}>
            <div className="ad-status-left">
              <span className="ad-status-icon">{row.icon}</span>
              <span className="ad-status-label">{row.label}</span>
            </div>

            {row.pill ? (
              <span className={row.pillClass}>
                <span className="ad-dot" />
                {row.pill}
              </span>
            ) : (
              <span className={`ad-status-value tone-${row.tone}`}>{row.value}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default RestaurantStatus;