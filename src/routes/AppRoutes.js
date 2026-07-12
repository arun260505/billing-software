import React from "react";

import {
    BrowserRouter,
    Routes,
    Route,
    Navigate
} from "react-router-dom";

import Login from "../pages/Auth/Login";

import SuperAdminDashboard from "../pages/SuperAdmin/Dashboard";

import AdminDashboard from "../pages/Admin/Dashboard";

import CashierDashboard from "../pages/Cashier/Dashboard";

import WaiterDashboard from "../pages/Waiter/Dashboard";

import KitchenDashboard from "../pages/Kitchen/Dashboard";

function AppRoutes() {

    const token = localStorage.getItem("token");

    const user = JSON.parse(localStorage.getItem("user"));

    return (

        <BrowserRouter>

            <Routes>

                <Route
                    path="/"
                    element={
                        token
                            ? <Navigate to={`/${user.role}`} replace />
                            : <Login />
                    }
                />

                <Route
                    path="/super_admin"
                    element={
                        token && user?.role === "super_admin"
                            ? <SuperAdminDashboard />
                            : <Navigate to="/" replace />
                    }
                />

                <Route
                    path="/admin"
                    element={
                        token && user?.role === "admin"
                            ? <AdminDashboard />
                            : <Navigate to="/" replace />
                    }
                />

                <Route
                    path="/cashier"
                    element={
                        token && user?.role === "cashier"
                            ? <CashierDashboard />
                            : <Navigate to="/" replace />
                    }
                />

                <Route
                    path="/waiter"
                    element={
                        token && user?.role === "waiter"
                            ? <WaiterDashboard />
                            : <Navigate to="/" replace />
                    }
                />

                <Route
                    path="/kitchen"
                    element={
                        token && user?.role === "kitchen"
                            ? <KitchenDashboard />
                            : <Navigate to="/" replace />
                    }
                />

            </Routes>

        </BrowserRouter>

    );

}

export default AppRoutes;