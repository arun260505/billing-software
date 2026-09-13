import api from "./api";

// The salon's active stylists — { id, full_name } — for the billing screen.
export const getStylists = () =>
    api.get("/employees/stylists");

// Today's live board: each stylist's customers, bills, services and sales.
export const getStylistBoard = () =>
    api.get("/dashboard/stylists");
