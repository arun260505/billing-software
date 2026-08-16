import api from "./api";

// Active tickets (each order = one ticket) with their items.
export const getKitchenTickets = () => api.get("/kitchen/tickets");

// Active items grouped by table (billed tables drop off).
export const getKitchenTables = () => api.get("/kitchen/tables");

// Kitchen marks a single item served.
export const markKitchenItemServed = (itemId) => api.put(`/kitchen/item/${itemId}/serve`);

// Advance a ticket's status: Pending -> Preparing -> Ready -> Served.
export const updateTicketStatus = (id, status) =>
    api.put(`/kitchen/orders/${id}`, { order_status: status });
