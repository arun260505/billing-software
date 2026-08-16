import { useEffect, useState } from "react";
import { getTables, updateTableStatus } from "../../services/tableService";
import "../../styles/pages/Waiter/Dashboard.css";
import { getCategories, getItemsByCategory } from "../../services/menuService";
import { createOrder, getRunningOrders, getOrderDetails, updateOrder, cancelOrder, getTodaysOrderCount } from "../../services/orderService";
import RunningOrders from "../../components/Waiter/RunningOrders";
import CategoryTabs from "../../components/Waiter/CategoryTabs";
import MenuCard from "../../components/Waiter/MenuCard";
import CartItem from "../../components/Waiter/CartItem";

function Dashboard() {
    // ── Existing state (unchanged) ──────────────────────────────────
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);
    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [cart, setCart] = useState([]);
    const [runningOrders, setRunningOrders] = useState([]);
    const [todayOrders, setTodayOrders] = useState(0);
    const [editingOrder, setEditingOrder] = useState(null);
    const [showRunningOrders, setShowRunningOrders] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [orderNumber, setOrderNumber] = useState(1001);
    const [waiterName] = useState("John");
    const [currentDate, setCurrentDate] = useState("");
    const [currentTime, setCurrentTime] = useState("");

    // ── UI-only state (no business logic) ──────────────────────────
    const [tableFilter, setTableFilter] = useState("all");
    const [tableSearch, setTableSearch] = useState("");

    // ── Existing functions (unchanged) ──────────────────────────────
    function updateDateTime() {
        const now = new Date();
        setCurrentDate(now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }));
        setCurrentTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }

    useEffect(() => {
        updateDateTime();
        loadTables();
        loadRunningOrders();
        loadCategories();
        loadTodaysOrderCount();

        const statsTimer = setInterval(() => {
            loadRunningOrders();
            loadTodaysOrderCount();
        }, 30000);

        return () => clearInterval(statsTimer);
    }, []);

    useEffect(() => {
        if (selectedCategory) loadMenuItems(selectedCategory);
    }, [selectedCategory]);

    const filteredItems = menuItems.filter((item) =>
        item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalItems = cart.reduce((sum, item) => sum + Number(item.quantity), 0);

    const normalizeQuantity = (value) => {
        const parsed = Number(value);
        return !Number.isFinite(parsed) ? 0 : Math.round(parsed);
    };

    const getItemQuantityLimit = (item) => {
        const qty = Number(item.available_quantity);
        if (!Number.isFinite(qty)) return Number.POSITIVE_INFINITY;
        if (qty <= 1) return qty === 0 ? 0 : Number.POSITIVE_INFINITY;
        return qty;
    };

    const addToCart = (item) => {
        if (!selectedTable) {
            alert("Please select a table first.");
            return;
        }
        const existingItem = cart.find((c) => c.id === item.id);
        const limit = getItemQuantityLimit(item);
        if (existingItem && normalizeQuantity(existingItem.quantity) >= limit) {
            alert(`Only ${limit} items available.`);
            return;
        }
        setCart((prev) => {
            const cur = prev.find((c) => c.id === item.id);
            if (cur) {
                return prev.map((c) =>
                    c.id === item.id
                        ? { ...c, quantity: normalizeQuantity(c.quantity) + 1, available_quantity: item.available_quantity }
                        : c
                );
            }
            return [...prev, { ...item, quantity: 1, isNew: true }];
        });
    };

    const newOrder = () => {
        setCart([]);
        setEditingOrder(null);
        setOrderNumber((prev) => prev + 1);
        updateDateTime();
    };

    const loadCategories = async () => {
        try {
            const res = await getCategories();
            setCategories(res.data.data);
            if (res.data.data.length > 0) setSelectedCategory(res.data.data[0].id);
        } catch (e) { console.error(e); }
    };

    const loadTables = async () => {
        try {
            const data = await getTables();
            setTables(data.data);
        } catch (e) { console.error(e); }
    };

    const handleSelectTable = async (table) => {
        setSelectedTable(table);
        await loadCategories();
        // Each table selection starts a FRESH batch, so every "Send to Kitchen"
        // creates a new order = a separate kitchen ticket (never merged into the
        // table's previous batch). Corrections to a specific order are still
        // possible via the Running Orders panel.
        setCart([]);
        setEditingOrder(null);
    };

    const loadMenuItems = async (categoryId) => {
        try {
            const res = await getItemsByCategory(categoryId);
            setMenuItems(res.data.data);
        } catch (e) { console.error(e); }
    };

    const loadRunningOrders = async () => {
        try {
            const res = await getRunningOrders();
            setRunningOrders(res.data.data);
        } catch (e) { console.error("Error loading running orders:", e); }
    };

    const loadTodaysOrderCount = async () => {
        try {
            const res = await getTodaysOrderCount();
            setTodayOrders(Number(res.data.data) || 0);
        } catch (e) { console.error("Error loading today's order count:", e); }
    };

    const openOrder = async (order) => {
        try {
            const res = await getOrderDetails(order.id);
            const items = res.data.data.map((item) => ({
                id: item.menu_item_id,
                menu_item_id: item.menu_item_id,
                item_name: item.item_name,
                quantity: normalizeQuantity(item.quantity),
                originalQuantity: normalizeQuantity(item.quantity),
                price: Number(item.price),
                gst: 5,
                available_quantity: 999,
                isNew: false,
            }));
            setCart(items);
            setEditingOrder(order);
            setShowRunningOrders(false);
        } catch (e) {
            console.error(e);
            alert("Failed to load order.");
        }
    };

    const increaseQuantity = (id) => {
        const cartItem = cart.find((item) => item.id === id);
        if (!cartItem) return;
        const limit = getItemQuantityLimit(cartItem);
        if (normalizeQuantity(cartItem.quantity) >= limit) {
            alert(`Only ${limit} items available.`);
            return;
        }
        setCart((prev) =>
            prev.map((item) =>
                item.id === id ? { ...item, quantity: normalizeQuantity(item.quantity) + 1 } : item
            )
        );
    };

    const decreaseQuantity = (id) => {
        setCart((prev) =>
            prev
                .map((item) =>
                    item.id === id ? { ...item, quantity: normalizeQuantity(item.quantity) - 1 } : item
                )
                .filter((item) => item.quantity > 0)
        );
    };

    const removeItem = (id) => {
        setCart((prev) => prev.filter((item) => item.id !== id));
    };

    const clearCart = () => setCart([]);

    const handleChangeTable = async () => {
        if (cart.length > 0) {
            const ok = window.confirm("You have an unfinished order. Discard it?");
            if (!ok) return;
        }
        setSelectedTable(null);
        setCart([]);
        setEditingOrder(null);
        await loadTables();
    };

    const placeOrder = async () => {
        if (cart.length === 0) { alert("Please add items."); return; }
        if (!selectedTable) { alert("Please select a table first."); return; }
        const orderData = {
            order_number: `ORD-${Date.now()}`,
            waiter_id: 1,
            table_id: selectedTable?.id || null,
            items: cart.map((item) => ({
                menu_item_id: item.id,
                quantity: item.quantity,
                price: item.price,
                gst: item.gst,
            })),
        };
        try {
            if (editingOrder) {
                await updateOrder(editingOrder.id, orderData);
                alert("Order Updated Successfully");
                setEditingOrder(null);
            } else {
                await createOrder(orderData);
                if (selectedTable && selectedTable.id) {
                    await updateTableStatus(selectedTable.id, "OCCUPIED");
                    setSelectedTable({ ...selectedTable, status: "OCCUPIED" });
                    await loadTables();
                }
                alert(selectedTable?.isParcel ? "Parcel Order Sent To Kitchen" : "Order Sent To Kitchen");
                setOrderNumber((prev) => prev + 1);
            }
            setCart([]);
            setSelectedTable(null);
            setEditingOrder(null);
            updateDateTime();
            await loadTables();
            await loadRunningOrders();
            await loadTodaysOrderCount();
        } catch (error) {
            console.error("Order Error:", error);
            alert(error.response?.data?.message || "Failed to place order.");
        }
    };

    const handleCancelOrder = async () => {
        if (!editingOrder) { alert("Please open an existing order first."); return; }
        if (!window.confirm("Are you sure you want to cancel this order?")) return;
        try {
            await cancelOrder(editingOrder.id);
            if (selectedTable && selectedTable.id) {
                await updateTableStatus(selectedTable.id, "FREE");
                setSelectedTable({ ...selectedTable, status: "FREE" });
                await loadTables();
            }
            alert("Order Cancelled Successfully");
            setCart([]);
            setSelectedTable(null);
            setEditingOrder(null);
            await loadTables();
            await loadRunningOrders();
            await loadTodaysOrderCount();
        } catch (e) {
            console.error(e);
            alert("Failed to cancel order.");
        }
    };

    // ── UI-only computed values ─────────────────────────────────────
    const availableCount = tables.filter((t) => t.status === "FREE").length;
    const occupiedCount  = tables.filter((t) => t.status === "OCCUPIED").length;

    const visibleTables = tables.filter((t) => {
        const matchFilter =
            tableFilter === "all"      ? true :
            tableFilter === "available" ? t.status === "FREE" :
            tableFilter === "occupied"  ? t.status === "OCCUPIED" : false;
        const matchSearch = !tableSearch ||
            `T${t.table_number}`.toLowerCase().includes(tableSearch.toLowerCase());
        return matchFilter && matchSearch;
    });

    // ── Table icon SVG ──────────────────────────────────────────────
    const TableIcon = ({ seats }) => (
        <svg className="table-svg-icon" viewBox="0 0 64 48" fill="none">
            {/* top chairs */}
            {seats >= 4 && <><rect x="10" y="2" width="12" height="8" rx="3"/><rect x="42" y="2" width="12" height="8" rx="3"/></>}
            {seats === 2 && <rect x="26" y="2" width="12" height="8" rx="3"/>}
            {/* table surface */}
            <rect x="8" y="14" width="48" height="10" rx="3"/>
            {/* legs */}
            <rect x="16" y="24" width="5" height="14" rx="2"/>
            <rect x="43" y="24" width="5" height="14" rx="2"/>
            {/* bottom chairs */}
            {seats >= 4 && <><rect x="10" y="38" width="12" height="8" rx="3"/><rect x="42" y="38" width="12" height="8" rx="3"/></>}
            {seats === 2 && <rect x="26" y="38" width="12" height="8" rx="3"/>}
            {/* side chairs for 6-seater */}
            {seats >= 6 && <><rect x="0" y="17" width="6" height="8" rx="3"/><rect x="58" y="17" width="6" height="8" rx="3"/></>}
        </svg>
    );

    // ── Render ──────────────────────────────────────────────────────
    return (
        <div className="waiter-app">

            {/* ══════════════ TOP NAVBAR ══════════════ */}
            <nav className="app-navbar">
                <div className="nav-left">
                    <button className="nav-hamburger">
                        <span/><span/><span/>
                    </button>
                    <div className="nav-brand">
                        <span className="nav-brand-name">The InWallz Restaurant</span>
                        <span className="nav-open-badge">● Open</span>
                    </div>
                </div>
                <div className="nav-right">
                    <button className="nav-icon-btn nav-notif" onClick={() => setShowRunningOrders(true)} title="Running Orders">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        </svg>
                        {runningOrders.length > 0 && <span className="notif-dot">{runningOrders.length}</span>}
                    </button>
                    <div className="nav-time-block">
                        <span className="nav-time">{currentTime}</span>
                        <span className="nav-date">{currentDate}</span>
                    </div>
                    <div className="nav-user">
                        <div className="nav-avatar">{waiterName.charAt(0)}</div>
                        <div className="nav-user-info">
                            <span className="nav-user-name">{waiterName}</span>
                            <span className="nav-user-id">Waiter ID: W102</span>
                        </div>
                    </div>
                </div>
            </nav>

            {/* ══════════════ STATS ROW ══════════════ */}
            <div className="app-stats">
                <div className="stat-card">
                    <div className="stat-icon-wrap stat-blue">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div className="stat-text">
                        <span className="stat-label">Today's Orders</span>
                        <span className="stat-value">{todayOrders}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon-wrap stat-red">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    </div>
                    <div className="stat-text">
                        <span className="stat-label">Active Orders</span>
                        <span className="stat-value">{runningOrders.length}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon-wrap stat-green">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </div>
                    <div className="stat-text">
                        <span className="stat-label">Available Tables</span>
                        <span className="stat-value">{availableCount}</span>
                    </div>
                </div>
            </div>

            {/* ══════════════ TABLE STATUS ══════════════ */}
            <div className="table-status-section">
                <div className="tss-header">
                    <h3 className="tss-title">Table Status</h3>
                    <div className="tss-search-wrap">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input
                            type="text"
                            className="tss-search"
                            placeholder="Search Table..."
                            value={tableSearch}
                            onChange={(e) => setTableSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Filter tabs */}
                <div className="table-filter-tabs">
                    {[
                        { key: "all",       label: `All (${tables.length})`,         cls: "tft-all" },
                        { key: "available", label: `Available (${availableCount})`,  cls: "tft-available" },
                        { key: "occupied",  label: `Occupied (${occupiedCount})`,    cls: "tft-occupied" },
                        { key: "reserved",  label: "Reserved (0)",                   cls: "tft-reserved" },
                        { key: "needs-bill",label: "Needs Bill (0)",                 cls: "tft-needsbill" },
                    ].map((f) => (
                        <button
                            key={f.key}
                            className={`tft-btn ${f.cls} ${tableFilter === f.key ? "tft-active" : ""}`}
                            onClick={() => setTableFilter(f.key)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Table cards grid */}
                <div className="table-status-grid">
                    {visibleTables.map((table) => {
                        const isFree     = table.status === "FREE";
                        const isSelected = selectedTable?.id === table.id;
                        return (
                            <div
                                key={table.id}
                                className={`tsc ${isFree ? "tsc-free" : "tsc-occupied"} ${isSelected ? "tsc-selected" : ""}`}
                                onClick={() => handleSelectTable(table)}
                            >
                                <div className="tsc-head">
                                    <span className="tsc-num">T{table.table_number}</span>
                                    <span className="tsc-cap">{table.capacity} Seater</span>
                                </div>
                                <div className="tsc-body">
                                    <TableIcon seats={table.capacity} />
                                </div>
                                <div className={`tsc-status-badge ${isFree ? "badge-free" : "badge-occupied"}`}>
                                    {isFree ? "Available" : "Occupied"}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ══════════════ 2-COLUMN WORKSPACE ══════════════ */}
            <div className="main-workspace">

                {/* ── LEFT: Active Cart ── */}
                <div className="workspace-cart">
                    <div className="wc-header">
                        <div className="wc-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                            <div className="wc-title-text">
                                <span>
                                    {selectedTable
                                        ? (selectedTable.isParcel ? "Active Order – Parcel" : `Active Order – T${selectedTable.table_number}`)
                                        : "Active Order"}
                                </span>
                                <span className="wc-order-meta">
                                    {editingOrder ? editingOrder.order_number : `ORD-${orderNumber}`}
                                    {totalItems > 0 && <span className="wc-item-badge">{totalItems}</span>}
                                </span>
                            </div>
                        </div>
                        <div className="wc-header-actions">
                            {selectedTable && (
                                <button className="wc-change-btn" onClick={handleChangeTable} title="Change table">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                                </button>
                            )}
                            <button className="wc-new-btn" onClick={newOrder} title="New order">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                        </div>
                        <button className="wc-clear-btn" onClick={clearCart} title="Clear cart">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                    </div>

                    <div className="wc-items">
                        {cart.length === 0 ? (
                            <div className="wc-empty">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                                <p>No items yet</p>
                                <span>Select a table &amp; add items from the menu</span>
                            </div>
                        ) : (
                            cart.map((item) => (
                                <CartItem
                                    key={item.id}
                                    item={item}
                                    increaseQuantity={increaseQuantity}
                                    decreaseQuantity={decreaseQuantity}
                                    removeItem={removeItem}
                                />
                            ))
                        )}
                    </div>

                    <div className="wc-footer">
                        <div className="wc-instructions-row">
                            <input type="text" className="wc-instructions-input" placeholder="Special Instructions..." />
                            <button className="wc-copy-btn" title="Copy">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            </button>
                        </div>
                        <button className="wc-send-btn" onClick={placeOrder}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                            {editingOrder ? "Update Order" : "Send to Kitchen"}
                        </button>
                        {editingOrder && (
                            <button className="wc-cancel-btn" onClick={handleCancelOrder}>
                                ✕ Cancel Order
                            </button>
                        )}
                    </div>
                </div>

                {/* ── MIDDLE: Menu ── */}
                <div className="workspace-menu">
                    <div className="menu-top-bar">
                        <h2 className="menu-title">Menu</h2>
                        <div className="menu-search-wrap">
                            <svg className="menu-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                            <input
                                type="text"
                                className="menu-search-input"
                                placeholder="Search menu items..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className="menu-filter-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
                            </svg>
                        </button>
                    </div>

                    <CategoryTabs
                        categories={categories}
                        selectedCategory={selectedCategory}
                        onSelectCategory={setSelectedCategory}
                    />

                    <div className="menu-items">
                        {filteredItems.length === 0 ? (
                            <p className="no-items-msg">No items available</p>
                        ) : (
                            filteredItems.map((item) => (
                                <MenuCard key={item.id} item={item} addToCart={addToCart} />
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* ══════════════ BOTTOM STATUS BAR ══════════════ */}
            <div className="app-status-bar">
                <div className="asb-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Kitchen Avg. Time: <strong>18 min</strong>
                </div>
                <div className="asb-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Pending Orders: <strong>{runningOrders.length}</strong>
                </div>
                <div className="asb-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    Top Item: <strong>Butter Chicken</strong>
                </div>
                <div className="asb-item asb-green">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    All systems operational
                </div>
            </div>

            {/* Running Orders modal (unchanged) */}
            {showRunningOrders && (
                <RunningOrders
                    runningOrders={runningOrders}
                    closeOrders={() => setShowRunningOrders(false)}
                    openOrder={openOrder}
                />
            )}
        </div>
    );
}

export default Dashboard;
