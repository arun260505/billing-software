import api from "./api";

// Active tickets (each order = one ticket) with their items.
export const getKitchenTickets = () => api.get("/kitchen/tickets");

// Advance a ticket's status: Pending -> Preparing -> Ready -> Served.
export const updateTicketStatus = (id, status) =>
    api.put(`/kitchen/orders/${id}`, { order_status: status });
