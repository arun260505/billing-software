import React from "react";

import Sidebar from "../../components/Admin/Sidebar";
import Header from "../../components/Admin/Header";

import DailySalesTable from "../../components/Admin/DailySalesTable";

import "../../styles/Admin/Dashboard.css";

function Reports() {

    return (
        <div className="dashboard-container">

            <Sidebar />

            <div className="dashboard-main">

                <Header />

                <div className="dashboard-content">

                    <DailySalesTable />

                </div>

            </div>

        </div>
    );
}

export default Reports;