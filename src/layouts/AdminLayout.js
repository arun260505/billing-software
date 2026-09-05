import React, { useState } from "react";
import { FaBars } from "react-icons/fa";

import Sidebar from "../components/Admin/Sidebar";
import Header from "../components/Admin/Header";

import "../styles/Layouts/AdminLayout.css";

// Below this the sidebar stops being a column beside the page and becomes a
// drawer over it — there simply isn't room for both.
const DRAWER_BREAKPOINT = 1024;

function AdminLayout({ children }) {

    // On a phone or a narrow window the sidebar starts closed. Left open it
    // covers the page it is supposed to navigate to.
    const [sidebarOpen, setSidebarOpen] = useState(
        () => typeof window === "undefined" || window.innerWidth > DRAWER_BREAKPOINT
    );

    const isDrawer =
        typeof window !== "undefined" && window.innerWidth <= DRAWER_BREAKPOINT;

    return (

        <div className={`admin-layout${sidebarOpen ? " sidebar-open" : ""}`}>

            <Sidebar
                isOpen={sidebarOpen}
            />

            {/* Tapping the page behind an open drawer closes it, the way every
                mobile nav does. Rendered only in drawer mode so it can never
                sit invisibly over the desktop layout. */}
            {isDrawer && sidebarOpen && (
                <button
                    type="button"
                    className="sidebar-scrim"
                    aria-label="Close menu"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

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