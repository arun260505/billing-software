import { useEffect, useState } from "react";
import authService from "../../services/authService";
import { getTables, updateTableStatus } from "../../services/tableService";
import "../../styles/pages/Waiter/Dashboard.css";
import { getCategories, getItemsByCategory, getAllItems } from "../../services/menuService";
import { createOrder, getRunningOrders, getOrderDetails, getTableItems, markOrderServed, markItemServed, cancelItem, setItemQuantity, addBillItem, updateOrder, cancelOrder, getTodaysOrderCount } from "../../services/orderService";
import RunningOrders from "../../components/Waiter/RunningOrders";
import CategoryTabs from "../../components/Waiter/CategoryTabs";
import MenuCard from "../../components/Waiter/MenuCard";
import CartSheet from "../../components/Waiter/CartSheet";
import BillModal from "../../components/Waiter/BillModal";
import kitchenFormatService from "../../services/kitchenFormatService";
import { printKitchenTicket, DEFAULT_KITCHEN_FORMAT } from "../../utils/kitchenPrinter";

function Dashboard() {
    // ── Existing state (unchanged) ──────────────────────────────────
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);
    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [allItems, setAllItems] = useState([]);   // whole menu (for search across categories)
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [cart, setCart] = useState([]);
    const [runningOrders, setRunningOrders] = useState([]);
    const [todayOrders, setTodayOrders] = useState(0);
    const [editingOrder, setEditingOrder] = useState(null);
    const [showRunningOrders, setShowRunningOrders] = useState(false);
    const [showBill, setShowBill] = useState(false);   // bill preview/edit modal
    const [billBusy, setBillBusy] = useState(false);
    const [showCart, setShowCart] = useState(false);   // new-order review sheet
    // The selected table's already-sent items, shown read-only for reference.
    const [previousItems, setPreviousItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [waiterName] = useState("John");
    const [currentDate, setCurrentDate] = useState("");
    const [currentTime, setCurrentTime] = useState("");
    const [kitchenFormat, setKitchenFormat] = useState(DEFAULT_KITCHEN_FORMAT);
    const [restaurantInfo, setRestaurantInfo] = useState(null);
    const [orderBusy, setOrderBusy] = useState(false);

    // ── UI-only state (no business logic) ──────────────────────────
    const [tableFilter, setTableFilter] = useState("all");
    const [tableSearch, setTableSearch] = useState("");

    // ── Existing functions (unchanged) ──────────────────────────────
    function updateDateTime() {
        const now = new Date();
        setCurrentDate(now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }));
        setCurrentTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }

    const loadKitchenFormat = async () => {
        try {
            const res = await kitchenFormatService.getKitchenFormat();
            if (res.data?.success && res.data?.data) {
                if (res.data.data.format) setKitchenFormat(res.data.data.format);
                if (res.data.data.restaurant) setRestaurantInfo(res.data.data.restaurant);
            }
        } catch (e) {
            console.error("Failed to load kitchen format in waiter:", e);
        }
    };

    useEffect(() => {
        updateDateTime();
        loadTables();
        loadRunningOrders();
        loadCategories();
        loadAllItems();
        loadTodaysOrderCount();
        loadKitchenFormat();

        const statsTimer = setInterval(() => {
            loadTables();
            loadRunningOrders();
            loadTodaysOrderCount();
            loadCategories();   // pick up menu categories synced from the cloud
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!selectedCategory) return;
        loadMenuItems(selectedCategory);
        // Poll so availability changes (e.g. cashier marks Idli sold out) show
        // up here within a few seconds without a manual refresh.
        const t = setInterval(() => loadMenuItems(selectedCategory), 4000);
        return () => clearInterval(t);
    }, [selectedCategory]);

    // While searching, keep the whole-menu list fresh (for live availability).
    useEffect(() => {
        if (!searchTerm.trim()) return;
        loadAllItems();
        const t = setInterval(loadAllItems, 4000);
        return () => clearInterval(t);
    }, [searchTerm]);

    // Keep the "already sent" list in sync so items the kitchen (or cashier)
    // marks served flip to served here within a few seconds, no refresh needed.
    useEffect(() => {
        if (!selectedTable || selectedTable.status !== "OCCUPIED") return;
        // Pause the auto-refresh while a sheet is open, otherwise the 4s re-render
        // makes the bill / add-item list blink (and can steal input focus).
        if (showBill || showCart) return;
        const t = setInterval(() => refreshTableItems(selectedTable.id), 4000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTable, showBill, showCart]);

    // When searching, look across the WHOLE menu (all categories); otherwise show
    // just the selected category's items.
    const term = searchTerm.trim().toLowerCase();
    const filteredItems = (term ? allItems : menuItems).filter((item) =>
        item.item_name.toLowerCase().includes(term)
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
        // Each add is its OWN line while building the order. Same items are
        // merged into quantities only when the order is sent to the kitchen.
        const limit = getItemQuantityLimit(item);
        const currentTotal = cart
            .filter((c) => c.id === item.id)
            .reduce((s, c) => s + normalizeQuantity(c.quantity), 0);
        if (currentTotal >= limit) {
            alert(`Only ${limit} items available.`);
            return;
        }
        // Merge into the NEW line that has NO note yet (so noted lines like
        // "juice — no ice" stay separate). Same item + same (empty) note = merge.
        setCart((prev) => {
            const idx = prev.findIndex((c) => c.id === item.id && c.isNew && !c.note);
            if (idx !== -1) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], quantity: normalizeQuantity(copy[idx].quantity) + 1 };
                return copy;
            }
            return [...prev, { ...item, quantity: 1, note: "", isNew: true, lineId: `${Date.now()}-${Math.random()}` }];
        });
    };

    // "−" on a menu card: drop one unit from the no-note line for this item.
    const removeOneFromCart = (item) => {
        setCart((prev) => {
            const idx = prev.findIndex((c) => c.id === item.id && c.isNew && !c.note);
            if (idx === -1) return prev;
            const line = prev[idx];
            if (normalizeQuantity(line.quantity) > 1) {
                const copy = [...prev];
                copy[idx] = { ...line, quantity: normalizeQuantity(line.quantity) - 1 };
                return copy;
            }
            return prev.filter((_, i) => i !== idx);
        });
    };

    // Set a per-line cooking note.
    const setLineNote = (lineId, note) => {
        setCart((prev) => prev.map((c) => (c.lineId === lineId ? { ...c, note } : c)));
    };

    // How many of a given menu item are currently in the NEW cart (for the card stepper).
    const cartQtyFor = (itemId) =>
        cart.filter((c) => c.id === itemId).reduce((s, c) => s + normalizeQuantity(c.quantity), 0);

    const handleLogout = () => {
        authService.logout();
        window.location.href = "/";
    };

    const loadCategories = async () => {
        try {
            const res = await getCategories();
            setCategories(res.data.data);
            // Only default the selection on first load; keep it on live re-polls
            // so a synced-in category doesn't yank the waiter's current tab.
            setSelectedCategory((cur) => cur || (res.data.data[0]?.id ?? null));
        } catch (e) { console.error(e); }
    };

    const loadTables = async () => {
        try {
            const data = await getTables();
            setTables(data.data);
        } catch (e) { console.error(e); }
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
        // A billed table is locked until the cashier settles/clears it.
        if (table.needs_bill) {
            alert(`Table ${table.table_number} is billed — waiting for the cashier to settle it. It'll reopen once cleared.`);
            return;
        }
        setSelectedTable(table);
        await loadCategories();
        // Fresh cart for the NEW batch (each send = a separate kitchen ticket).
        setCart([]);
        setShowCart(false);
        setEditingOrder(null);
        // Show the table's already-ordered items (all unpaid orders) read-only.
        if (table.status === "OCCUPIED") {
            await refreshTableItems(table.id);
        } else {
            setPreviousItems([]);
        }
    };

    const loadMenuItems = async (categoryId) => {
        try {
            const res = await getItemsByCategory(categoryId);
            setMenuItems(res.data.data);
        } catch (e) { console.error(e); }
    };

    // Whole menu, used when searching across all categories.
    const loadAllItems = async () => {
        try {
            const res = await getAllItems();
            setAllItems(res.data.data || []);
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

    const clearCart = () => setCart([]);

    const handleChangeTable = async () => {
        if (cart.length > 0) {
            const ok = window.confirm("You have an unfinished order. Discard it?");
            if (!ok) return;
        }
        setSelectedTable(null);
        setCart([]);
        setShowCart(false);
        setEditingOrder(null);
        setPreviousItems([]);
        await loadTables();
    };

    // Waiter marks a running order as served (removes it from the kitchen display).
    const handleMarkServed = async (order) => {
        try {
            await markOrderServed(order.id);
            await loadRunningOrders();
            await loadTables();
        } catch (e) {
            alert("Could not mark the order as served.");
        }
    };

    // Mark one item (order-item) served.
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

    // Adjust a bill line's quantity (− / +). Only edits the existing order — it
    // never creates a new kitchen ticket — and totals are recomputed server-side.
    const handleSetBillQty = async (rowId, qty) => {
        setBillBusy(true);
        try {
            await setItemQuantity(rowId, qty);
            await refreshTableItems(selectedTable.id);
            await loadRunningOrders();
        } catch (e) {
            alert("Could not update the quantity.");
        } finally {
            setBillBusy(false);
        }
    };

    // Add an item to the bill that was served but not recorded (no kitchen ticket).
    const handleAddBillItem = async (menuItem) => {
        setBillBusy(true);
        try {
            await addBillItem(selectedTable.id, menuItem.id, 1);
            await refreshTableItems(selectedTable.id);
            await loadRunningOrders();
        } catch (e) {
            alert("Could not add the item to the bill.");
        } finally {
            setBillBusy(false);
        }
    };

    // Remove a whole item line from the bill (customer changed their mind).
    const handleRemoveBillGroup = async (rows) => {
        const label = rows[0]?.item_name || "this item";
        if (!window.confirm(`Remove ${label} from the bill?`)) return;
        setBillBusy(true);
        try {
            for (const r of rows) await cancelItem(r.id);
            await refreshTableItems(selectedTable.id);
            await loadRunningOrders();
        } catch (e) {
            alert("Could not remove the item.");
        } finally {
            setBillBusy(false);
        }
    };

    // Confirm the (possibly edited) bill and send it to the cashier for printing.
    const requestBill = async () => {
        if (!selectedTable) return;
        setBillBusy(true);
        try {
            await updateTableStatus(selectedTable.id, "BILLING");
            alert(`Bill for ${selectedTable.table_number} sent to the cashier for printing.`);
            setShowBill(false);
            setSelectedTable(null);
            setPreviousItems([]);
            setCart([]);
            await loadTables();
        } catch (e) {
            alert("Could not send the bill to the cashier.");
        } finally {
            setBillBusy(false);
        }
    };

    const placeOrder = async () => {
        if (orderBusy) return;
        if (cart.length === 0) { alert("Please add items."); return; }
        if (!selectedTable) { alert("Please select a table first."); return; }

        setOrderBusy(true);
        // Merge lines that share the same item AND the same note; different notes
        // stay as separate order-items (e.g. juice "no ice" vs juice "with ice").
        const mergedItems = Object.values(
            cart.reduce((acc, item) => {
                const note = (item.note || "").trim();
                const k = `${item.id}|${note}`;
                if (!acc[k]) acc[k] = { menu_item_id: item.id, quantity: 0, price: item.price, gst: item.gst, notes: note || null };
                acc[k].quantity += normalizeQuantity(item.quantity);
                return acc;
            }, {})
        );
        const orderData = {
            order_number: `ORD-${Date.now()}`,
            waiter_id: 1,
            table_id: selectedTable?.id || null,
            order_type: selectedTable?.isParcel ? "Takeaway" : "Dine-In",
            items: mergedItems,
        };
        try {
            let assignedOrderNumber = orderData.order_number;
            if (editingOrder) {
                await updateOrder(editingOrder.id, orderData);
                assignedOrderNumber = editingOrder.order_number;
                alert("Order Updated Successfully");
                setEditingOrder(null);
            } else {
                const res = await createOrder(orderData);
                if (res.data?.data?.order_number) {
                    assignedOrderNumber = res.data.data.order_number;
                }
                if (selectedTable && selectedTable.id) {
                    // Keep an already-billed table tagged "Billed" (the cashier
                    // hasn't settled it yet); otherwise mark it Occupied.
                    if (selectedTable.db_status !== "Billing") {
                        await updateTableStatus(selectedTable.id, "OCCUPIED");
                    }
                    await loadTables();
                }
                alert(selectedTable?.isParcel ? "Parcel Order Sent To Kitchen" : "Order Sent To Kitchen");
            }

            // Print KOT to kitchen printer
            printKitchenTicket({
                order: {
                    order_number: assignedOrderNumber,
                    order_type: selectedTable?.isParcel ? "Takeaway" : "Dine-In",
                    isParcel: Boolean(selectedTable?.isParcel),
                    tableName: selectedTable?.isParcel ? "PARCEL" : `Table ${selectedTable.table_number}`,
                    table_number: selectedTable?.table_number,
                    items: mergedItems,
                    waiter_name: waiterName,
                    date: currentDate,
                    time: currentTime
                },
                restaurant: restaurantInfo || {},
                format: kitchenFormat || {}
            });

            setCart([]);
            setShowCart(false);
            setSelectedTable(null);
            setEditingOrder(null);
            setPreviousItems([]);
            updateDateTime();
            await loadTables();
            await loadRunningOrders();
            await loadTodaysOrderCount();
        } catch (error) {
            console.error("Order Error:", error);
            alert(error.response?.data?.message || "Failed to place order.");
        } finally {
            setOrderBusy(false);
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
    const billedCount    = tables.filter((t) => t.needs_bill).length;
    const occupiedCount  = tables.filter((t) => t.status === "OCCUPIED" && !t.needs_bill).length;

    const visibleTables = tables.filter((t) => {
        const matchFilter =
            tableFilter === "all"      ? true :
            tableFilter === "available" ? t.status === "FREE" :
            tableFilter === "needs-bill" ? t.needs_bill :
            tableFilter === "occupied"  ? (t.status === "OCCUPIED" && !t.needs_bill) : false;
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

            {/* ═══════ SCREEN 1: pick a table (shown until one is selected) ═══════ */}
            {!selectedTable && (
            <>
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
                        { key: "needs-bill",label: `Billed (${billedCount})`,        cls: "tft-needsbill" },
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
                        const isBilled   = table.needs_bill;   // bill sent to cashier
                        const isSelected = selectedTable?.id === table.id;
                        const stateCls   = isFree ? "tsc-free" : isBilled ? "tsc-billed tsc-locked" : "tsc-occupied";
                        const badgeCls   = isFree ? "badge-free" : isBilled ? "badge-billed" : "badge-occupied";
                        const badgeText  = isFree ? "Available" : isBilled ? "🔒 Billed" : "Occupied";
                        return (
                            <div
                                key={table.id}
                                className={`tsc ${stateCls} ${isSelected ? "tsc-selected" : ""}`}
                                onClick={() => handleSelectTable(table)}
                            >
                                <div className="tsc-head">
                                    <span className="tsc-num">T{table.table_number}</span>
                                    <span className="tsc-cap">{table.capacity} Seater</span>
                                </div>
                                <div className="tsc-body">
                                    <TableIcon seats={table.capacity} />
                                </div>
                                {!isFree && Number(table.total_items) > 0 && (
                                    <div className="tsc-served">
                                        {Number(table.served_items)}/{Number(table.total_items)} served
                                    </div>
                                )}
                                <div className={`tsc-status-badge ${badgeCls}`}>
                                    {badgeText}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            </>
            )}

            {/* ═══════ SCREEN 2: the selected table's menu + order ═══════ */}
            {selectedTable && (
            <div className="main-workspace">

                {/* Back bar — return to the tables screen (+ Bill for sent items) */}
                <div className="ws-backbar">
                    <button className="ws-back" onClick={handleChangeTable}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="15 18 9 12 15 6"/></svg>
                        Tables
                    </button>
                    <span className="ws-back-table">
                        {selectedTable.isParcel ? "Parcel" : `Table ${selectedTable.table_number}`}
                    </span>
                    {previousItems.length > 0 && (
                        <button className="ws-bill-chip" onClick={() => { loadAllItems(); setShowBill(true); }}>🧾 Bill</button>
                    )}
                </div>

                {/* Already sent to kitchen — static (doesn't grow when adding new
                    items, so the menu below never shifts). Serve items here. */}
                {previousItems.length > 0 && (
                    <div className="ws-sent">
                        <div className="ws-sent-label">🍽 Already sent to kitchen</div>
                        {previousItems.map((it) => (
                            <div key={it.id} className={`ws-sent-row${it.served ? " served" : ""}`}>
                                <span>{it.quantity}× {it.item_name}</span>
                                {it.served ? (
                                    <span className="wc-served-tag">✓ Served</span>
                                ) : (
                                    <button className="wc-item-serve" onClick={() => handleServeItem(it)}>Serve</button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Menu (the main, stable scroll area) ── */}
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
                        onSelectCategory={(id) => { setSearchTerm(""); setSelectedCategory(id); }}
                    />

                    <div className="menu-items">
                        {filteredItems.length === 0 ? (
                            <p className="no-items-msg">No items available</p>
                        ) : (
                            filteredItems.map((item) => (
                                <MenuCard
                                    key={item.id}
                                    item={item}
                                    quantity={cartQtyFor(item.id)}
                                    addToCart={addToCart}
                                    removeOneFromCart={removeOneFromCart}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* keeps the last menu items clear of the fixed Send bar */}
                {cart.length > 0 && <div className="wc-send-spacer" aria-hidden="true" />}
            </div>
            )}

            {/* Always-visible bar — opens the order sheet to review before sending */}
            {selectedTable && cart.length > 0 && (
                <div className="wc-sticky-send">
                    <button className="wc-send-btn" onClick={() => setShowCart(true)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                        {editingOrder ? "Review & Update" : "Review & Send"}
                        <span className="wc-send-count">{totalItems}</span>
                    </button>
                </div>
            )}

            {/* Order review sheet (opened from the bottom bar) */}
            {showCart && selectedTable && (
                <CartSheet
                    tableLabel={selectedTable.isParcel ? "Parcel" : `Table ${selectedTable.table_number}`}
                    items={cart}
                    editing={!!editingOrder}
                    busy={orderBusy}
                    increaseQuantity={increaseQuantity}
                    decreaseQuantity={decreaseQuantity}
                    removeItem={removeItem}
                    setNote={setLineNote}
                    onClear={() => { clearCart(); setShowCart(false); }}
                    onSend={placeOrder}
                    onCancelOrder={handleCancelOrder}
                    onClose={() => setShowCart(false)}
                />
            )}

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
                    onMarkServed={handleMarkServed}
                />
            )}

            {/* Bill preview / edit before sending to the cashier */}
            {showBill && selectedTable && (
                <BillModal
                    tableLabel={selectedTable.isParcel ? "Parcel" : `Table ${selectedTable.table_number}`}
                    items={previousItems}
                    menuItems={allItems}
                    busy={billBusy}
                    onSetQty={handleSetBillQty}
                    onRemoveGroup={handleRemoveBillGroup}
                    onAddItem={handleAddBillItem}
                    onConfirm={requestBill}
                    onClose={() => setShowBill(false)}
                />
            )}
        </div>
    );
}

export default Dashboard;
