import React, { useEffect, useState, useCallback } from "react";
import { getKitchenTables, markKitchenItemServed } from "../../services/kitchenService";
import "../../styles/pages/Kitchen/Dashboard.css";

// Kitchen display grouped by table. Each item has a Serve button that strikes it
// through. Once a table is billed it drops off the board automatically.
function Dashboard() {

    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [, setTick] = useState(0); // refresh the "time ago" labels

    const load = useCallback(async () => {
        try {
            const res = await getKitchenTables();
            setTables(res.data.data || []);
            setError("");
        } catch (e) {
            setError(e.response?.data?.message || "Could not load the kitchen board.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const poll = setInterval(load, 4000);
        const clock = setInterval(() => setTick((t) => t + 1), 1000);
        return () => { clearInterval(poll); clearInterval(clock); };
    }, [load]);

    const serve = async (tableId, item) => {
        // optimistic strike-through
        setTables((prev) =>
            prev.map((t) =>
                t.table_id !== tableId ? t : {
                    ...t,
                    items: t.items.map((it) => (it.id === item.id ? { ...it, served: 1 } : it)),
                }
            )
        );
        try {
            await markKitchenItemServed(item.id);
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

    const totalTables = tables.length;

    // The board is a cooking queue, so the table that has been waiting longest
    // comes first — not alphabetical table order. A table is "waiting" from its
    // oldest item that is still unserved; tables with nothing left to cook fall
    // to the end.
    const waitingSince = (t) => {
        const times = t.items
            .filter((it) => !Number(it.served))
            .map((it) => new Date(it.created_at).getTime())
            .filter((n) => Number.isFinite(n));
        return times.length ? Math.min(...times) : Number.POSITIVE_INFINITY;
    };
    const orderedTables = [...tables].sort((a, b) => waitingSince(a) - waitingSince(b));

    return (
        <div className="kitchen-app">

            {/* Fixed table strip at the top */}
            <header className="kd-header">
                <div className="kd-title">
                    <h1>Kitchen</h1>
                    <span className="kd-count">{totalTables} table{totalTables === 1 ? "" : "s"}</span>
                </div>
                <div className="kd-tablebar">
                    {orderedTables.map((t) => {
                        const pending = t.items.filter((it) => !Number(it.served)).length;
                        return (
                            <a key={t.table_id} href={`#tbl-${t.table_id}`} className={`kd-tab${pending === 0 ? " done" : ""}`}>
                                {String(t.table_name).toUpperCase()}
                                {pending > 0 && <span className="kd-tab-badge">{pending}</span>}
                            </a>
                        );
                    })}
                </div>
                <button className="kd-logout" onClick={handleLogout}>Logout</button>
            </header>

            {error && <div className="kd-error">{error}</div>}

            {loading ? (
                <div className="kd-empty">Loading…</div>
            ) : tables.length === 0 ? (
                <div className="kd-empty">No active tables. New orders appear here automatically.</div>
            ) : (
                <div className="kd-grid">
                    {orderedTables.map((t) => {
                        const served = t.items.filter((it) => Number(it.served)).length;
                        const allDone = served === t.items.length;
                        // Unserved on top, OLDEST first, so the kitchen cooks in the
                        // order the food was ordered — first in, first out. (This
                        // used to be newest-first, which quietly pushed the ticket
                        // that had been waiting longest to the bottom of the queue.)
                        // Served items sink below the rest.
                        const sortedItems = [...t.items].sort((a, b) => {
                            const sa = Number(a.served), sb = Number(b.served);
                            if (sa !== sb) return sa - sb;
                            return (new Date(a.created_at) - new Date(b.created_at)) || (a.id - b.id);
                        });
                        return (
                            <div key={t.table_id} id={`tbl-${t.table_id}`} className={`kd-table${allDone ? " all-served" : ""}`}>
                                <div className="kd-table-head">
                                    <span className="kd-table-name">
                                        {String(t.table_name).toUpperCase()}
                                        {t.order_number && <small className="kd-ordno">{t.order_number}</small>}
                                    </span>
                                    <span className="kd-table-count">{served}/{t.items.length} served</span>
                                </div>
                                <ul className="kd-items">
                                    {sortedItems.map((it) => {
                                        const isNew = !Number(it.served) &&
                                            (Date.now() - new Date(it.created_at).getTime()) < 90000;
                                        return (
                                            <li key={it.id} className={Number(it.served) ? "kd-item-served" : ""}>
                                                <span className="kd-qty">{Number(it.quantity)}×</span>
                                                <span className="kd-item-name">{it.item_name}</span>
                                                {isNew && <span className="kd-new">NEW</span>}
                                                {it.notes && <span className="kd-note">— {it.notes}</span>}
                                                {Number(it.served) ? (
                                                    <span className="kd-served">✓ served</span>
                                                ) : (
                                                    <button className="kd-serve" onClick={() => serve(t.table_id, it)}>Serve</button>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default Dashboard;
