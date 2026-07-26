import React, { useState } from "react";
import { FaBars } from "react-icons/fa";

import Sidebar from "../components/Admin/Sidebar";
import Header from "../components/Admin/Header";

import "../styles/Layouts/AdminLayout.css";

function AdminLayout({ children }) {

    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (

        <div className="admin-layout">

            <Sidebar
                isOpen={sidebarOpen}
            />

            <div
                className={`admin-main ${sidebarOpen ? "" : "expanded"}`}
            >

                <Header />

                <div className="page-content">

                    <button
                        className="sidebar-toggle"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        <FaBars />
                    </button>

                    {children}

                </div>

            </div>

        </div>

    );

}

export default AdminLayout;