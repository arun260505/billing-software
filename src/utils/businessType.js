import authService from "../services/authService";

/*
| Restaurant or salon.
|
| Set by the super admin when the business is created, never changed after, and
| carried on the logged-in user (the login response includes it). A session
| saved before business types existed has no value — that is a restaurant,
| which is what every business was then.
|
| This only decides what the screens show. The backend enforces the same split
| on its own (middleware/businessTypeMiddleware.js).
*/

export const businessTypeOf = (user = authService.getUser()) =>
    user?.business_type === "salon" ? "salon" : "restaurant";

export const isSalon = (user = authService.getUser()) =>
    businessTypeOf(user) === "salon";

// "Salon" / "Restaurant", for headings and copy.
export const businessLabel = (user = authService.getUser()) =>
    isSalon(user) ? "Salon" : "Restaurant";

// Where a signed-in user belongs. null for a role this kind of business doesn't
// have — callers show the login instead of redirecting "/" back to "/" forever.
export function homeFor(user) {
    if (!user) return null;
    const salon = isSalon(user);
    switch (user.role) {
        case "super_admin": return "/super_admin";
        case "admin":       return "/admin/dashboard";
        case "cashier":     return salon ? "/salon/pos" : "/cashier";
        case "waiter":      return salon ? null : "/waiter";
        case "kitchen":     return salon ? null : "/kitchen";
        default:            return null;
    }
}

const ROLE_LABELS = {
    super_admin: "Super Admin",
    admin: "Admin",
    cashier: "Cashier",
    waiter: "Waiter",
    kitchen: "Kitchen",
    stylist: "Stylist"
};

// A salon's admin is its owner, and its cashier works the front desk. The
// stored roles stay admin / cashier so permissions and the till are unchanged.
export function roleLabel(role, user = authService.getUser()) {
    if (isSalon(user)) {
        if (role === "admin") return "Owner";
        if (role === "cashier") return "Receptionist";
    }
    return ROLE_LABELS[role] || role;
}

// A salon bill has no table, waiter or food licence line, whatever the saved
// bill format says (it was designed for restaurants and defaults them on).
export const salonBillFormat = (format = {}) => ({
    ...format,
    show_table_name: 0,
    show_waiter_name: 0,
    show_fssai: 0
});
