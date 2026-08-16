import React, { useEffect, useState, useCallback } from "react";
import { getKitchenTickets, updateTicketStatus } from "../../services/kitchenService";
import "../../styles/pages/Kitchen/Dashboard.css";

function timeAgo(iso) {
    const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
}

// Orders auto-start as "Preparing" when sent. The only kitchen action is to mark
// an order served (the waiter can also do this) — which removes it from here.
function Dashboard() {

    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [, setTick] = useState(0); // forces the "time ago" labels to refresh

    const load = useCallback(async () => {
        try {
            const res = await getKitchenTickets();
            setTickets(res.data.data || []);
            setError("");
        } catch (e) {
            setError(e.response?.data?.message || "Could not load kitchen tickets.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const poll = setInterval(load, 5000);      // pull new tickets every 5s
        const clock = setInterval(() => setTick((t) => t + 1), 1000); // update timers
        return () => { clearInterval(poll); clearInterval(clock); };
    }, [load]);

    const markServed = async (ticket) => {
        // remove from the board immediately
        setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
        try {
            await updateTicketStatus(ticket.id, "Served");
        } catch (e) {
            alert(e.response?.data?.message || "Could not mark served.");
            load();
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/";
    };

    return (
        <div className="kitchen-app">

            <header className="kd-header">
                <div className="kd-title">
                    <h1>Kitchen Display</h1>
                    <span className="kd-count">{tickets.length} active</span>
                </div>
                <button className="kd-logout" onClick={handleLogout}>Logout</button>
            </header>

            {error && <div className="kd-error">{error}</div>}

            {loading ? (
                <div className="kd-empty">Loading tickets…</div>
            ) : tickets.length === 0 ? (
                <div className="kd-empty">No active orders. New tickets appear here automatically.</div>
            ) : (
                <div className="kd-grid">
                    {tickets.map((t) => (
                        <div key={t.id} className={`kd-ticket status-${t.status.toLowerCase()}`}>
                            <div className="kd-ticket-head">
                                <span className="kd-table">{t.table_name || "—"}</span>
                                <span className={`kd-status status-${t.status.toLowerCase()}`}>{t.status}</span>
                            </div>
                            <div className="kd-ticket-sub">
                                <span className="kd-order-no">{t.order_number}</span>
                                <span className="kd-time">{timeAgo(t.created_at)}</span>
                            </div>
                            <ul className="kd-items">
                                {t.items.map((it, i) => (
                                    <li key={i}>
                                        <span className="kd-qty">{Number(it.quantity)}×</span>
                                        <span className="kd-item-name">{it.item_name}</span>
                                        {it.notes && <span className="kd-note">— {it.notes}</span>}
                                    </li>
                                ))}
                            </ul>
                            <button className="kd-advance" onClick={() => markServed(t)}>
                                ✓ Mark Served
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Dashboard;
