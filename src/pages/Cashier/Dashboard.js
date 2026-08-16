import { useEffect, useState } from "react";
import authService from "../../services/authService";
import { getTables, updateTableStatus } from "../../services/tableService";
import "../../styles/pages/Cashier/Dashboard.css";
import { getCategories, getItemsByCategory } from "../../services/menuService";
import { createOrder, getRunningOrders, getOrderDetails, getTableItems, settleTable, markItemServed, updateOrder, cancelOrder, getTodaysOrderCount } from "../../services/orderService";
import RunningOrders from "../../components/Waiter/RunningOrders";
import CategoryTabs from "../../components/Waiter/CategoryTabs";
import MenuCard from "../../components/Waiter/MenuCard";
import CartItem from "../../components/Waiter/CartItem";
import BillModal from "../../components/Cashier/BillModal";
import MenuAvailability from "../../components/Cashier/MenuAvailability";

function Dashboard() {
    // ── State ───────────────────────────────────────────────────────
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
    // The selected table's already-ordered items, shown read-only for reference.
    const [previousItems, setPreviousItems] = useState([]);

    // Clear the read-only order view whenever no table is selected.
    useEffect(() => {
        if (!selectedTable) setPreviousItems([]);
    }, [selectedTable]);

    // Dedicated Menu (availability) screen toggle.
    const [showMenuAvail, setShowMenuAvail] = useState(false);
    const [showBill, setShowBill] = useState(false);
    const [billData, setBillData] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [orderNumber, setOrderNumber] = useState(1001);
    const [cashierName] = useState("Cashier");
    const [currentDate, setCurrentDate] = useState("");
    const [currentTime, setCurrentTime] = useState("");

    // ── UI-only state ───────────────────────────────────────────────
    const [tableFilter, setTableFilter] = useState("all");
    const [tableSearch, setTableSearch] = useState("");

    // ── Functions ───────────────────────────────────────────────────
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
            loadTables();
            loadRunningOrders();
            loadTodaysOrderCount();
        }, 10000);

        const refreshOnFocus = () => {
            loadTables();
            loadRunningOrders();
            loadTodaysOrderCount();
        };
        window.addEventListener("focus", refreshOnFocus);

        return () => {
            clearInterval(statsTimer);
            window.removeEventListener("focus", refreshOnFocus);
        };
    }, []);

    useEffect(() => {
        if (!selectedCategory) return;
        loadMenuItems(selectedCategory);
        // Poll so availability changes from another cashier/admin appear live.
        const t = setInterval(() => loadMenuItems(selectedCategory), 4000);
        return () => clearInterval(t);
    }, [selectedCategory]);

    // Keep the current-order list in sync so items the kitchen (or waiter) marks
    // served flip to served here within a few seconds, no refresh needed.
    useEffect(() => {
        if (!selectedTable || selectedTable.status !== "OCCUPIED") return;
        const t = setInterval(() => refreshTableItems(selectedTable.id), 4000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTable]);

    const filteredItems = menuItems.filter((item) =>
        item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalItems = cart.reduce((sum, item) => sum + Number(item.quantity), 0);
    const subtotal   = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const gst        = subtotal * 0.05;
    const grandTotal = subtotal + gst;

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
        // Each add is its own line; same items merge into quantities on send.
        const limit = getItemQuantityLimit(item);
        const currentTotal = cart
            .filter((c) => c.id === item.id)
            .reduce((s, c) => s + normalizeQuantity(c.quantity), 0);
        if (currentTotal >= limit) {
            alert(`Only ${limit} items available.`);
            return;
        }
        setCart((prev) => [
            ...prev,
            { ...item, quantity: 1, isNew: true, lineId: `${Date.now()}-${Math.random()}` },
        ]);
    };

    const newOrder = () => {
        if (blockIfParcelLocked()) return;
        setCart([]);
        setEditingOrder(null);
        setOrderNumber((prev) => prev + 1);
        updateDateTime();
    };

    const handleLogout = () => {
        authService.logout();
        window.location.href = "/";
    };

    const openRunningOrders = () => {
        if (blockIfParcelLocked()) return;
        setShowRunningOrders(true);
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

    const blockIfParcelLocked = () => {
        if (selectedTable?.isParcel && editingOrder) {
            alert("Please complete billing for the current Parcel order first.");
            return true;
        }
        return false;
    };

    // Pull a table's already-sent items (with their served flags) from the server.
    const refreshTableItems = async (tableId) => {
        try {
            const res = await getTableItems(tableId);
            setPreviousItems(
                (res.data.data || []).map((it) => ({
                    id: it.id,
                    item_name: it.item_name,
                    quantity: Number(it.quantity),
                    price: Number(it.price),
                    served: Number(it.served),
                }))
            );
        } catch (e) {
            setPreviousItems([]);
        }
    };

    const handleSelectTable = async (table) => {
        if (blockIfParcelLocked()) return;
        setSelectedTable(table);
        await loadCategories();
        // Fresh cart for new items (each send = a new kitchen ticket).
        setCart([]);
        setEditingOrder(null);
        // Show the table's current (unpaid) order read-only.
        if (table.status === "OCCUPIED") {
            await refreshTableItems(table.id);
        } else {
            setPreviousItems([]);
        }
    };

    const handleParcelSelect = () => {
        if (blockIfParcelLocked()) return;
        setSelectedTable({ id: null, table_number: "Parcel", isParcel: true, status: "FREE" });
        setCart([]);
        setEditingOrder(null);
    };

    const loadMenuItems = async (categoryId) => {
        try {
            const res = await getItemsByCategory(categoryId);
            setMenuItems(res.data.data);
        } catch (e) { console.error(e); }
    };

    // Cashier marks one item (order-item) served.
    const handleServeItem = async (item) => {
        setPreviousItems((prev) =>
            prev.map((it) => (it.id === item.id ? { ...it, served: 1 } : it))
        );
        try {
            await markItemServed(item.id);
            await loadRunningOrders();
        } catch (e) {
            setPreviousItems((prev) =>
                prev.map((it) => (it.id === item.id ? { ...it, served: 0 } : it))
            );
            alert("Could not mark the item as served.");
        }
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
            const items = res.data.data.map((item, idx) => ({
                id: item.menu_item_id,
                menu_item_id: item.menu_item_id,
                item_name: item.item_name,
                quantity: normalizeQuantity(item.quantity),
                originalQuantity: normalizeQuantity(item.quantity),
                price: Number(item.price),
                gst: 5,
                available_quantity: 999,
                isNew: false,
                lineId: `existing-${item.menu_item_id}-${idx}`,
            }));
            setCart(items);
            setEditingOrder(order);
            setShowRunningOrders(false);
        } catch (e) {
            console.error(e);
            alert("Failed to load order.");
        }
    };

    const increaseQuantity = (lineId) => {
        setCart((prev) =>
            prev.map((item) =>
                item.lineId === lineId ? { ...item, quantity: normalizeQuantity(item.quantity) + 1 } : item
            )
        );
    };

    const decreaseQuantity = (lineId) => {
        setCart((prev) =>
            prev
                .map((item) =>
                    item.lineId === lineId ? { ...item, quantity: normalizeQuantity(item.quantity) - 1 } : item
                )
                .filter((item) => item.quantity > 0)
        );
    };

    const removeItem = (lineId) => {
        setCart((prev) => prev.filter((item) => item.lineId !== lineId));
    };

    // Merge the separate cart lines into one entry per menu item (used when
    // sending the order and when building the bill).
    const mergeCartItems = (list) =>
        Object.values(
            list.reduce((acc, it) => {
                const k = it.id;
                if (!acc[k]) {
                    acc[k] = {
                        menu_item_id: it.id,
                        item_name: it.item_name || it.name,
                        quantity: 0,
                        price: it.price,
                        gst: it.gst,
                    };
                }
                acc[k].quantity += normalizeQuantity(it.quantity);
                return acc;
            }, {})
        );

    const clearCart = () => {
        if (blockIfParcelLocked()) return;
        setCart([]);
    };

    const handleChangeTable = async () => {
        if (blockIfParcelLocked()) return;
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
            items: mergeCartItems(cart),
        };
        try {
            if (editingOrder) {
                await updateOrder(editingOrder.id, orderData);
                alert(selectedTable?.isParcel ? "Parcel Order Updated" : "Order Updated Successfully");
                if (!selectedTable?.isParcel) {
                    setEditingOrder(null);
                }
            } else {
                const res = await createOrder(orderData);
                if (selectedTable && selectedTable.id) {
                    await updateTableStatus(selectedTable.id, "OCCUPIED");
                    setSelectedTable({ ...selectedTable, status: "OCCUPIED" });
                    await loadTables();
                }
                alert(selectedTable?.isParcel ? "Parcel Order Sent To Kitchen" : "Order Sent To Kitchen");
                setOrderNumber((prev) => prev + 1);
                if (selectedTable?.isParcel) {
                    setEditingOrder({ id: res.data.data.order_id, order_number: res.data.data.order_number });
                }
            }
            if (!selectedTable?.isParcel) {
                setCart([]);
                setSelectedTable(null);
                setEditingOrder(null);
            }
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

    const handleProceedToBilling = async () => {
        if (cart.length === 0) { alert("Please add items."); return; }
        if (!selectedTable) { alert("Please select a table first."); return; }

        let orderId = editingOrder?.id;

        if (!orderId) {
            const orderData = {
                order_number: `ORD-${Date.now()}`,
                waiter_id: 1,
                table_id: selectedTable?.id || null,
                order_type: selectedTable?.isParcel ? "Takeaway" : "Dine-In",
                items: mergeCartItems(cart),
            };
            try {
                const res = await createOrder(orderData);
                orderId = res.data.data.order_id;
            } catch (error) {
                console.error("Order Error:", error);
                alert(error.response?.data?.message || "Failed to place order.");
                return;
            }
        }

        const serviceCharge = subtotal * 0.02;

        setBillData({
            order_id: orderId,
            order_number: editingOrder ? editingOrder.order_number : `ORD-${orderNumber}`,
            tableName: selectedTable?.isParcel ? "Parcel" : `Table ${selectedTable.table_number}`,
            isParcel: !!selectedTable?.isParcel,
            items: mergeCartItems(cart),
            subtotal: Number(subtotal.toFixed(2)),
            gst: Number(gst.toFixed(2)),
            serviceCharge: Number(serviceCharge.toFixed(2)),
            total: Number((subtotal + gst + serviceCharge).toFixed(2)),
        });
        setShowBill(true);
    };

    const handlePaymentSuccess = () => {
        setShowBill(false);
        setBillData(null);
        setCart([]);
        if (!billData?.isParcel) {
            setSelectedTable(null);
        }
        setEditingOrder(null);
        alert("Bill Generated Successfully");
        updateDateTime();
        loadTables();
        loadRunningOrders();
        loadTodaysOrderCount();
    };

    // Print a table's bill (waiter requested it), then settle: mark the table's
    // orders paid and free the table.
    const printBill = async (table) => {
        try {
            const res = await getTableItems(table.id);
            const items = res.data.data || [];
            const sub = items.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
            const gstAmt = sub * 0.05;
            const total = sub + gstAmt;
            const w = window.open("", "PrintBill", "width=340,height=560");
            if (w) {
                w.document.write(
                    `<div style="font-family:monospace;padding:12px">
                       <h3 style="text-align:center;margin:0">InWallz</h3>
                       <p style="text-align:center;margin:2px 0 10px">Table ${table.table_number}</p><hr>` +
                    items.map((i) => `<div style="display:flex;justify-content:space-between"><span>${i.item_name} x${i.quantity}</span><span>&#8377;${(Number(i.price) * Number(i.quantity)).toFixed(0)}</span></div>`).join("") +
                    `<hr>
                       <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>&#8377;${sub.toFixed(0)}</span></div>
                       <div style="display:flex;justify-content:space-between"><span>GST 5%</span><span>&#8377;${gstAmt.toFixed(0)}</span></div>
                       <div style="display:flex;justify-content:space-between;font-weight:bold"><span>TOTAL</span><span>&#8377;${total.toFixed(0)}</span></div>
                       <p style="text-align:center;margin-top:12px">Thank you!</p></div>`
                );
                w.document.close();
                w.focus();
                w.print();
            }
            await settleTable(table.id);
            alert(`Table ${table.table_number} printed & settled — now Available.`);
            setSelectedTable(null);
            setPreviousItems([]);
            setCart([]);
            await loadTables();
        } catch (e) {
            alert("Could not print / settle the bill.");
        }
    };

    // ── UI computed values ──────────────────────────────────────────
    const availableCount = tables.filter((t) => t.status === "FREE").length;
    const occupiedCount  = tables.filter((t) => t.status === "OCCUPIED").length;
    const serviceCharge  = subtotal * 0.02;
    const displayTotal   = grandTotal + serviceCharge;

    const visibleTables = tables.filter((t) => {
        const matchFilter =
            tableFilter === "all"       ? true :
            tableFilter === "available" ? t.status === "FREE" :
            tableFilter === "occupied"  ? t.status === "OCCUPIED" : false;
        const matchSearch = !tableSearch ||
            `T${t.table_number}`.toLowerCase().includes(tableSearch.toLowerCase());
        return matchFilter && matchSearch;
    });

    const TableIcon = ({ seats }) => (
        <svg className="table-svg-icon" viewBox="0 0 64 48" fill="none">
            {seats >= 4 && <><rect x="10" y="2" width="12" height="8" rx="3"/><rect x="42" y="2" width="12" height="8" rx="3"/></>}
            {seats === 2 && <rect x="26" y="2" width="12" height="8" rx="3"/>}
            <rect x="8" y="14" width="48" height="10" rx="3"/>
            <rect x="16" y="24" width="5" height="14" rx="2"/>
            <rect x="43" y="24" width="5" height="14" rx="2"/>
            {seats >= 4 && <><rect x="10" y="38" width="12" height="8" rx="3"/><rect x="42" y="38" width="12" height="8" rx="3"/></>}
            {seats === 2 && <rect x="26" y="38" width="12" height="8" rx="3"/>}
            {seats >= 6 && <><rect x="0" y="17" width="6" height="8" rx="3"/><rect x="58" y="17" width="6" height="8" rx="3"/></>}
        </svg>
    );

    // ── Render ──────────────────────────────────────────────────────
    return (
        <div className="cashier-app">

            {/* ══ NAVBAR ══ */}
            <nav className="app-navbar">
                <div className="nav-left">
                    <button className="nav-hamburger"><span/><span/><span/></button>
                    <div className="nav-brand">
                        <span className="nav-brand-name">The InWallz Restaurant</span>
                        <span className="nav-open-badge">● Open</span>
                    </div>
                </div>
                <div className="nav-right">
                    <button className="nav-menu-btn" onClick={() => setShowMenuAvail(true)} title="Menu availability">
                        🍽 Menu
                    </button>
                    <button className="nav-icon-btn nav-notif" onClick={openRunningOrders} title="Running Orders">
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
                        <div className="nav-avatar">{cashierName.charAt(0)}</div>
                        <div className="nav-user-info">
                            <span className="nav-user-name">{cashierName}</span>
                            <span className="nav-user-id">Cashier ID: C101</span>
                        </div>
                    </div>
                    <button className="nav-logout" onClick={handleLogout} title="Logout">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Logout
                    </button>
                </div>
            </nav>

            {/* ══ BILLS TO PRINT (waiter requests) ══ */}
            {tables.filter((t) => t.needs_bill).length > 0 && (
                <div className="cashier-print-alert">
                    <span className="cpa-title">🔔 Bills to print:</span>
                    {tables.filter((t) => t.needs_bill).map((t) => (
                        <button key={t.id} className="cpa-btn" onClick={() => printBill(t)}>
                            🖨 Print &amp; Settle {t.table_number}
                        </button>
                    ))}
                </div>
            )}

            {/* ══ STATS ══ */}
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

            {/* ══ TABLE STATUS ══ */}
            <div className="table-status-section">
                <div className="tss-header">
                    <h3 className="tss-title">Table Status</h3>
                    <div className="tss-search-wrap">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" className="tss-search" placeholder="Search Table..." value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} />
                    </div>
                </div>

                <div className="table-filter-tabs">
                    {[
                        { key: "all",        label: `All (${tables.length})`,        cls: "tft-all" },
                        { key: "available",  label: `Available (${availableCount})`, cls: "tft-available" },
                        { key: "occupied",   label: `Occupied (${occupiedCount})`,   cls: "tft-occupied" },
                        { key: "reserved",   label: "Reserved (0)",                  cls: "tft-reserved" },
                        { key: "needs-bill", label: "Needs Bill (0)",                cls: "tft-needsbill" },
                    ].map((f) => (
                        <button key={f.key} className={`tft-btn ${f.cls} ${tableFilter === f.key ? "tft-active" : ""}`} onClick={() => setTableFilter(f.key)}>
                            {f.label}
                        </button>
                    ))}
                </div>

                <div className="table-status-grid">
                    {visibleTables.map((table) => {
                        const isFree     = table.status === "FREE";
                        const isSelected = selectedTable?.id === table.id;
                        return (
                            <div key={table.id} className={`tsc ${isFree ? "tsc-free" : "tsc-occupied"} ${isSelected ? "tsc-selected" : ""}`} onClick={() => handleSelectTable(table)}>
                                <div className="tsc-head">
                                    <span className="tsc-num">T{table.table_number}</span>
                                    <span className="tsc-cap">{table.capacity} Seater</span>
                                </div>
                                <div className="tsc-body"><TableIcon seats={table.capacity} /></div>
                                <div className={`tsc-status-badge ${isFree ? "badge-free" : "badge-occupied"}`}>
                                    {isFree ? "Available" : "Occupied"}
                                </div>
                            </div>
                        );
                    })}
                    <div className={`tsc tsc-parcel ${selectedTable?.isParcel ? "tsc-selected" : ""}`} onClick={handleParcelSelect}>
                        <div className="tsc-head"><span className="tsc-num">📦</span><span className="tsc-cap">Parcel</span></div>
                        <div className="tsc-body tsc-parcel-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
                            </svg>
                        </div>
                        <div className="tsc-status-badge badge-parcel">Parcel</div>
                    </div>
                </div>
            </div>

            {/* ══ 3-COLUMN WORKSPACE ══ */}
            <div className="main-workspace">

                {/* LEFT: Cart */}
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
                        {previousItems.length > 0 && (
                            <div className="wc-previous">
                                <div className="wc-previous-label">🍽 Current order (unpaid)</div>
                                {previousItems.map((it) => (
                                    <div key={it.id} className={`wc-previous-row${it.served ? " served" : ""}`}>
                                        <span>{it.quantity}× {it.item_name}</span>
                                        {it.served ? (
                                            <span className="wc-served-tag">✓ Served</span>
                                        ) : (
                                            <button className="wc-item-serve" onClick={() => handleServeItem(it)}>
                                                Serve
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button className="wc-bill-btn" onClick={() => printBill(selectedTable)}>
                                    🖨 Print &amp; Settle
                                </button>
                                <div className="wc-previous-divider">＋ New items (sent as a new ticket)</div>
                            </div>
                        )}
                        {cart.length === 0 ? (
                            <div className="wc-empty">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                                <p>No items yet</p>
                                <span>Select a table &amp; add items from the menu</span>
                            </div>
                        ) : (
                            cart.map((item) => (
                                <CartItem key={item.lineId} item={item} increaseQuantity={increaseQuantity} decreaseQuantity={decreaseQuantity} removeItem={removeItem} />
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
                            <button className="wc-cancel-btn" onClick={handleCancelOrder}>✕ Cancel Order</button>
                        )}
                    </div>
                </div>

                {/* MIDDLE: Menu */}
                <div className="workspace-menu">
                    <div className="menu-top-bar">
                        <h2 className="menu-title">Menu</h2>
                        <div className="menu-search-wrap">
                            <svg className="menu-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" className="menu-search-input" placeholder="Search menu items..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <button className="menu-filter-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
                        </button>
                    </div>
                    <CategoryTabs categories={categories} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
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

                {/* RIGHT: Order Summary */}
                <div className="workspace-summary">
                    <div className="ws-header">
                        <span className="ws-title">Order Summary</span>
                        <button className="ws-trash-btn" onClick={clearCart}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                    </div>
                    <div className="ws-items">
                        {cart.length === 0 ? (
                            <div className="ws-empty">No items added</div>
                        ) : (
                            cart.map((item) => (
                                <div key={item.lineId} className="ws-line">
                                    <span className="ws-item-name">{item.item_name}</span>
                                    <span className="ws-item-calc">₹{item.price} × {item.quantity}</span>
                                    <span className="ws-item-total">₹{(item.price * item.quantity).toFixed(0)}</span>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="ws-totals">
                        <div className="ws-row"><span>Subtotal</span><span>₹{subtotal.toFixed(0)}</span></div>
                        <div className="ws-row"><span>GST (5%)</span><span>₹{gst.toFixed(0)}</span></div>
                        <div className="ws-row"><span>Service Charge (2%)</span><span>₹{serviceCharge.toFixed(0)}</span></div>
                    </div>
                    <div className="ws-total-row">
                        <span className="ws-total-label">Total Amount</span>
                        <span className="ws-total-value">₹{displayTotal.toFixed(0)}</span>
                    </div>
                    <button className="ws-proceed-btn" onClick={handleProceedToBilling}>
                        Proceed to Billing
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </button>
                    <button className="ws-save-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Save Order
                    </button>
                </div>
            </div>

            {/* ══ STATUS BAR ══ */}
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

            {/* Running Orders modal */}
            {showRunningOrders && (
                <RunningOrders runningOrders={runningOrders} closeOrders={() => setShowRunningOrders(false)} openOrder={openOrder} />
            )}

            {showMenuAvail && (
                <MenuAvailability onClose={() => setShowMenuAvail(false)} />
            )}

            {/* Bill generation modal */}
            {showBill && billData && (
                <BillModal
                    order={billData}
                    onClose={() => setShowBill(false)}
                    onSuccess={handlePaymentSuccess}
                />
            )}
        </div>
    );
}

export default Dashboard;