import { Navigate } from "react-router-dom";
import authService from "../services/authService";
import { businessTypeOf } from "../utils/businessType";

/**
 * Guards a route by authentication, (optionally) role and (optionally)
 * business type.
 *
 * Usage:
 *   <ProtectedRoute roles={["admin"]} types={["restaurant"]}>
 *       <Tables />
 *   </ProtectedRoute>
 *
 * - Not logged in                 -> redirect to "/"
 * - Logged in, wrong role         -> redirect to "/"
 * - Logged in, wrong business     -> redirect to "/" (a salon has no tables page)
 * - Logged in, allowed            -> render children
 *
 * "/" sends a signed-in user on to their own home, so a wrong turn lands them
 * back where they belong.
 */
function ProtectedRoute({ roles, types, children }) {

    const user = authService.getUser();
    const token = authService.getToken();

    if (!token || !user) {
        return <Navigate to="/" replace />;
    }

    if (roles && roles.length > 0 && !roles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    if (types && types.length > 0 && !types.includes(businessTypeOf(user))) {
        return <Navigate to="/" replace />;
    }

    return children;

}

export default ProtectedRoute;
