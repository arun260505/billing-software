import { useEffect, useState } from "react";
import { getAllItems, setItemAvailability } from "../../services/menuService";

// A dedicated full-screen "Menu" view for the cashier: every item grouped by
// category with an Available/Unavailable toggle. Changes save immediately.
function MenuAvailability() {

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const load = async () => {
        try {
            const res = await getAllItems();
            setItems(res.data.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const toggle = async (item) => {
        const next = Number(item.available_quantity) === 0 ? 1 : 0;
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available_quantity: next } : i)));
        try {
            await setItemAvailability(item.id, next);
        } catch (e) {
            setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available_quantity: next ? 0 : 1 } : i)));
            alert("Could not update availability.");
        }
    };

    const filtered = items.filter((i) =>
        (i.item_name || "").toLowerCase().includes(search.toLowerCase())
    );

    const groups = {};
    filtered.forEach((i) => {
        const k = i.category_name || "Other";
        (groups[k] = groups[k] || []).push(i);
    });

    return (
        <div className="menuview">

                <div className="menuavail-head">
                    <h2>🍽 Menu Availability</h2>
                    <input
                        className="menuavail-search"
                        placeholder="Search item…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="menuavail-body">
                    {loading ? (
                        <p className="menuavail-empty">Loading…</p>
                    ) : Object.keys(groups).length === 0 ? (
                        <p className="menuavail-empty">No items.</p>
                    ) : (
                        Object.entries(groups).map(([cat, list]) => (
                            <div key={cat} className="menuavail-cat">
                                <div className="menuavail-cat-title">{cat}</div>
                                {list.map((item) => {
                                    const off = Number(item.available_quantity) === 0;
                                    return (
                                        <div key={item.id} className={`menuavail-row${off ? " off" : ""}`}>
                                            <span className="menuavail-name">{item.item_name}</span>
                                            <span className="menuavail-price">₹{Number(item.price).toFixed(2)}</span>
                                            <button
                                                className={`menuavail-toggle${off ? " is-off" : " is-on"}`}
                                                onClick={() => toggle(item)}
                                            >
                                                {off ? "Unavailable" : "Available"}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

        </div>
    );
}

export default MenuAvailability;
