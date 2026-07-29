import { Navigate } from "react-router-dom";
import authService from "../services/authService";

/**
 * Guards a route by authentication and (optionally) role.
 *
 * Usage:
 *   <ProtectedRoute roles={["admin"]}>
 *       <AdminDashboard />
 *   </ProtectedRoute>
 *
 * - Not logged in            -> redirect to "/"
 * - Logged in, wrong role    -> redirect to "/"
 * - Logged in, allowed role  -> render children
 */
function ProtectedRoute({ roles, children }) {

    const user = authService.getUser();
    const token = authService.getToken();

    if (!token || !user) {
        return <Navigate to="/" replace />;
    }

    if (roles && roles.length > 0 && !roles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    return children;

}

export default ProtectedRoute;
