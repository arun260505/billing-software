import {
    BrowserRouter,
    Routes,
    Route,
    Navigate
} from "react-router-dom";

import authService from "../services/authService";
import ProtectedRoute from "../components/ProtectedRoute";

import Login from "../pages/Auth/Login";

import SuperAdminDashboard from "../pages/SuperAdmin/Dashboard";
import AdminDashboard from "../pages/Admin/Dashboard";
import CashierDashboard from "../pages/Cashier/Dashboard";
import WaiterDashboard from "../pages/Waiter/Dashboard";
import KitchenDashboard from "../pages/Kitchen/Dashboard";

import Reports from "../pages/Admin/Reports";
import Employee from "../pages/Admin/Employee";
import Categories from "../pages/Admin/Categories";
import Menu from "../pages/Admin/Menu";
import Tables from "../pages/Admin/Tables";

// Where each role lands after login / when hitting "/" while authenticated.
const roleHome = {
    super_admin: "/super_admin",
    admin: "/admin/dashboard",
    cashier: "/cashier",
    waiter: "/waiter",
    kitchen: "/kitchen"
};

function AppRoutes() {

    const user = authService.getUser();
    const token = authService.getToken();
    const isAuthed = Boolean(token && user);

    return (
        <BrowserRouter>
            <Routes>

                <Route
                    path="/"
                    element={
                        isAuthed
                            ? <Navigate to={roleHome[user.role] || "/"} replace />
                            : <Login />
                    }
                />

                <Route
                    path="/super_admin"
                    element={
                        <ProtectedRoute roles={["super_admin"]}>
                            <SuperAdminDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/admin"
                    element={<Navigate to="/admin/dashboard" replace />}
                />

                <Route
                    path="/admin/dashboard"
                    element={
                        <ProtectedRoute roles={["admin"]}>
                            <AdminDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/admin/reports"
                    element={
                        <ProtectedRoute roles={["admin"]}>
                            <Reports />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/admin/employees"
                    element={
                        <ProtectedRoute roles={["admin"]}>
                            <Employee />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/admin/categories"
                    element={
                        <ProtectedRoute roles={["admin"]}>
                            <Categories />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/admin/menu"
                    element={
                        <ProtectedRoute roles={["admin"]}>
                            <Menu />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/admin/tables"
                    element={
                        <ProtectedRoute roles={["admin"]}>
                            <Tables />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/cashier"
                    element={
                        <ProtectedRoute roles={["cashier"]}>
                            <CashierDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/waiter"
                    element={
                        <ProtectedRoute roles={["waiter"]}>
                            <WaiterDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/kitchen"
                    element={
                        <ProtectedRoute roles={["kitchen"]}>
                            <KitchenDashboard />
                        </ProtectedRoute>
                    }
                />

                {/* Unknown paths fall back to the entry route. */}
                <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>
        </BrowserRouter>
    );
}

export default AppRoutes;
