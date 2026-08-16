import React, { useEffect, useState, useCallback } from "react";
import { getKitchenTables, markKitchenItemServed } from "../../services/kitchenService";
import "../../styles/pages/Kitchen/Dashboard.css";

function timeAgo(iso) {
    const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
}

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

    return (
        <div className="kitchen-app">

            {/* Fixed table strip at the top */}
            <header className="kd-header">
                <div className="kd-title">
                    <h1>Kitchen</h1>
                    <span className="kd-count">{totalTables} table{totalTables === 1 ? "" : "s"}</span>
                </div>
                <div className="kd-tablebar">
                    {tables.map((t) => {
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
                    {tables.map((t) => {
                        const served = t.items.filter((it) => Number(it.served)).length;
                        const allDone = served === t.items.length;
                        // Unserved on top (newest first); served items sink to the bottom.
                        const sortedItems = [...t.items].sort((a, b) => {
                            const sa = Number(a.served), sb = Number(b.served);
                            if (sa !== sb) return sa - sb;
                            return (new Date(b.created_at) - new Date(a.created_at)) || (b.id - a.id);
                        });
                        return (
                            <div key={t.table_id} id={`tbl-${t.table_id}`} className={`kd-table${allDone ? " all-served" : ""}`}>
                                <div className="kd-table-head">
                                    <span className="kd-table-name">{String(t.table_name).toUpperCase()}</span>
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
