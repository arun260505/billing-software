import api from "./api";

// The salon's active stylists — { id, full_name } — for the billing screen.
export const getStylists = () =>
    api.get("/employees/stylists");

// Today's live board: each stylist's customers, bills, services and sales.
// Send the client's local (IST) date so "today" matches the wall clock, not the
// cloud server's UTC date.
const todayLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const getStylistBoard = () =>
    api.get("/dashboard/stylists", { params: { date: todayLocal() } });
