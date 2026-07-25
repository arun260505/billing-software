import React, { useEffect, useState } from "react";
import { getTableStatus } from "../../services/dashboardService";
import "../../styles/Admin/DashboardCard.css";

function RestaurantStatus() {
  const [tables, setTables] = useState([]);

useEffect(() => {
    fetchTableStatus();
}, []);

const fetchTableStatus = () => {
    getTableStatus()
        .then((response) => {
            if (response.data.success) {
                setTables(response.data.data);
            }
        })
        .catch((error) => {
            console.error("Table Status Error:", error);
        });
};

const occupiedTables = tables.filter(
    (table) => table.status === "Occupied"
).length;
  return (
    <div className="dashboard-widget">

      <h3>Restaurant Status</h3>

      <div className="status-row">
        <span>Restaurant</span>
        <span className="status-open">Open</span>
      </div>

      <div className="status-row">
  <span>Tables Occupied</span>
  <span>{occupiedTables} / {tables.length}</span>
</div>

      <div className="status-row">
        <span>Kitchen Orders</span>
        <span>14</span>
      </div>

      <div className="status-row">
        <span>Pending Bills</span>
        <span>6</span>
      </div>

      <div className="status-row">
        <span>Pending Sync</span>
        <span className="status-warning">3</span>
      </div>

    </div>
  );
}

export default RestaurantStatus;