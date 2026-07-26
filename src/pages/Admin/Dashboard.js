
import AdminLayout from "../../layouts/AdminLayout";
import DashboardCard from "../../components/Admin/DashboardCard";
import SalesChart from "../../components/Admin/SalesChart";
import RecentOrders from "../../components/Admin/RecentOrders";
import TopSelling from "../../components/Admin/TopSelling";
import RestaurantStatus from "../../components/Admin/RestaurantStatus";
import NotificationPanel from "../../components/Admin/NotificationPanel";
import PrinterStatus from "../../components/Admin/PrinterStatus";
import SyncStatus from "../../components/Admin/SyncStatus";
import React, { useEffect, useState } from "react";
import { getDashboardSummary } from "../../services/dashboardService";

import "../../styles/Admin/Dashboard.css";
import "../../styles/Admin/DashboardCard.css";

function Dashboard() {
  const [summary, setSummary] = useState({
  total_sales: 0,
  total_orders: 0,
  total_customers: 0,
  occupied_tables: 0
});

useEffect(() => {
  fetchSummary();
}, []);

const fetchSummary = () => {
  getDashboardSummary()
    .then((response) => {
      if (response.data.success) {
        setSummary(response.data.data);
      }
    })
    .catch((error) => {
      console.error("Dashboard Summary Error:", error);
    });
};

 return (
    <AdminLayout>

        <div className="dashboard-content">

          <div className="cards-grid">

            <DashboardCard
              title="Today's Sales"
              value={`₹${Number(summary.total_sales).toLocaleString("en-IN")}`}
              icon="💰"
              color="#2563EB"
              growth="+12%"
            />

            <DashboardCard
              title="Orders"
              value={summary.total_orders}
              icon="🧾"
              color="#22C55E"
              growth="+8%"
            />

            <DashboardCard
              title="Customers"
              value={summary.total_customers}
              icon="👥"
              color="#F59E0B"
              growth="+15%"
            />

            <DashboardCard
              title="Tables"
              value={summary.occupied_tables}
              growth="Occupied"
            
              icon="🍽️"
              color="#EF4444"
              
            />

          </div>
          <SalesChart />

<RecentOrders />
<div className="dashboard-grid-two">

    <TopSelling />

    <RestaurantStatus />

</div>
<div className="dashboard-grid-two">

    <NotificationPanel />

    <div>

        <PrinterStatus />

        <br />

        <SyncStatus />

    </div>

</div>

                </div>

    </AdminLayout>
);
}

export default Dashboard;