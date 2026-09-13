import {
    BrowserRouter,
    Routes,
    Route,
    Navigate
} from "react-router-dom";

import authService from "../services/authService";
import ProtectedRoute from "../components/ProtectedRoute";
import { homeFor, isSalon } from "../utils/businessType";

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
import Charges from "../pages/Admin/Charges";
import Orders from "../pages/Admin/Orders";
import Billing from "../pages/Admin/Billing";
import KitchenTemplate from "../pages/Admin/KitchenTemplate";
import Settings from "../pages/Admin/Settings";
import Customers from "../pages/Admin/Customers";

import SalonDashboard from "../pages/Salon/Dashboard";
import Services from "../pages/Salon/Services";
import Inventory from "../pages/Salon/Inventory";
import SalonPos from "../pages/Salon/Pos";

// Who may open each back-office page. A salon and a restaurant share the admin
// shell and most pages; the ones that only make sense for one of them say so
// with `types`.
const RESTAURANT = ["restaurant"];
const SALON = ["salon"];

const adminPage = (element, types) => (
    <ProtectedRoute roles={["admin"]} types={types}>
        {element}
    </ProtectedRoute>
);

function AppRoutes() {

    const user = authService.getUser();
    const token = authService.getToken();
    const isAuthed = Boolean(token && user);

    // Where "/" sends a signed-in user. null (a role this business doesn't
    // have) shows the login rather than redirecting "/" to itself.
    const home = isAuthed ? homeFor(user) : null;

    return (
        <BrowserRouter>
            <Routes>

                <Route
                    path="/"
                    element={home ? <Navigate to={home} replace /> : <Login />}
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

                {/* The page reloads on login and logout, so the user read above
                    is the one signed in for the life of this render. */}
                <Route
                    path="/admin/dashboard"
                    element={adminPage(isAuthed && isSalon(user) ? <SalonDashboard /> : <AdminDashboard />)}
                />

                <Route path="/admin/reports" element={adminPage(<Reports />)} />
                <Route path="/admin/employees" element={adminPage(<Employee />)} />
                <Route path="/admin/categories" element={adminPage(<Categories />)} />
                <Route path="/admin/customers" element={adminPage(<Customers />)} />
                <Route path="/admin/charges" element={adminPage(<Charges />)} />
                <Route path="/admin/orders" element={adminPage(<Orders />)} />
                <Route path="/admin/billing" element={adminPage(<Billing />)} />
                <Route path="/admin/settings" element={adminPage(<Settings />)} />

                {/* Restaurant only */}
                <Route path="/admin/menu" element={adminPage(<Menu />, RESTAURANT)} />
                <Route path="/admin/tables" element={adminPage(<Tables />, RESTAURANT)} />
                <Route path="/admin/kitchen-template" element={adminPage(<KitchenTemplate />, RESTAURANT)} />

                {/* Salon only */}
                <Route path="/admin/services" element={adminPage(<Services />, SALON)} />
                <Route path="/admin/inventory" element={adminPage(<Inventory />, SALON)} />

                <Route
                    path="/cashier"
                    element={
                        <ProtectedRoute roles={["cashier"]} types={RESTAURANT}>
                            <CashierDashboard />
                        </ProtectedRoute>
                    }
                />

                {/* A salon's receptionist — stored as the cashier role. */}
                <Route
                    path="/salon/pos"
                    element={
                        <ProtectedRoute roles={["cashier"]} types={SALON}>
                            <SalonPos />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/waiter"
                    element={
                        <ProtectedRoute roles={["waiter"]} types={RESTAURANT}>
                            <WaiterDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/kitchen"
                    element={
                        <ProtectedRoute roles={["kitchen"]} types={RESTAURANT}>
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
