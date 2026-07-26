import React from "react";

import AdminLayout from "../../layouts/AdminLayout";

import DailySalesTable from "../../components/Admin/DailySalesTable";

import "../../styles/Admin/Dashboard.css";

function Reports() {

    return (
    <AdminLayout>

        <div className="dashboard-content">

                    <DailySalesTable />

                                </div>

    </AdminLayout>
);
}

export default Reports;