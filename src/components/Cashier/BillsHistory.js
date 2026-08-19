import { useEffect, useState } from "react";
import { getTodaysBills } from "../../services/orderService";

// Today's settled bills. The cashier opens one to correct an item that was rung
// up twice or missed, then reprints it.
function BillsHistory({ onOpenBill }) {

    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const load = async () => {
        try {
            const res = await getTodaysBills();
            setBills(res.data.data || []);
        } catch (e) {
            console.error("Bills load error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    // Reload whenever a bill closes, so a corrected total shows straight away.
    useEffect(() => {
        const t = setInterval(load, 5000);
        return () => clearInterval(t);
    }, []);

    const term = search.trim().toLowerCase();
    const filtered = bills.filter((b) =>
        !term ||
        (b.order_number || "").toLowerCase().includes(term) ||
        (b.table_name ? `table ${b.table_name}` : "counter").includes(term)
    );

    const totalTaken = filtered.reduce((s, b) => s + Number(b.paid_amount || 0), 0);

    const timeOf = (iso) =>
        new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return (
        <div className="menuview">

            <div className="menuavail-head">
                <h2>🧾 Bills · Today</h2>
                <input
                    className="menuavail-search"
                    placeholder="Search bill no. or table…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <span className="bills-summary">
                    <b>{filtered.length}</b> bills · <b>₹{totalTaken.toFixed(2)}</b>
                </span>
            </div>

            <div className="bills-body">
                {loading ? (
                    <p className="menuavail-empty">Loading…</p>
                ) : filtered.length === 0 ? (
                    <p className="menuavail-empty">
                        {bills.length === 0
                            ? "No bills settled today yet."
                            : "No bill matches that search."}
                    </p>
                ) : (
                    <table className="bills-table">
                        <thead>
                            <tr>
                                <th>Bill No.</th>
                                <th>Where</th>
                                <th>Time</th>
                                <th className="num">Items</th>
                                <th>Paid via</th>
                                <th className="num">Total</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((b) => {
                                const corrected = Number(b.correction_count) > 0;
                                return (
                                    <tr key={b.id}>
                                        <td className="bills-no">{b.order_number}</td>
                                        <td>{b.table_name ? `Table ${b.table_name}` : "Counter"}</td>
                                        <td>{timeOf(b.created_at)}</td>
                                        <td className="num">{Number(b.item_count)}</td>
                                        <td>{b.payment_method || "—"}</td>
                                        <td className="num bills-amt">
                                            ₹{Number(b.grand_total).toFixed(2)}
                                            {corrected && <span className="bills-tag">edited</span>}
                                        </td>
                                        <td className="num">
                                            <button
                                                className="bills-open"
                                                onClick={() => onOpenBill(b)}
                                            >
                                                View / Edit
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

        </div>
    );
}

export default BillsHistory;
