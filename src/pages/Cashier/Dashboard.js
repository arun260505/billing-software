import { useEffect, useState } from "react";
import authService from "../../services/authService";
import { getTables, updateTableStatus } from "../../services/tableService";
import "../../styles/pages/Cashier/Dashboard.css";
import { getCategories, getItemsByCategory, getAllItems } from "../../services/menuService";
import { createOrder, getRunningOrders, getOrderDetails, getTableItems, settleTable, markItemServed, cancelItem, setItemQuantity, addBillItem, updateOrder, cancelOrder, getTodaysOrderCount, getBill, addItemToOrder, rebillOrder } from "../../services/orderService";
// Two printers coexist for now: billPrinter renders the admin-configured bill
// format and is used for the first print, while printBill carries the
// "REPRINT — CORRECTED BILL" stamp the Bills screen needs.
import { printBill as printCorrectedBill } from "../../utils/printBill";
import RunningOrders from "../../components/Waiter/RunningOrders";
import CategoryTabs from "../../components/Waiter/CategoryTabs";
import MenuCard from "../../components/Waiter/MenuCard";
import CartItem from "../../components/Waiter/CartItem";
import BillModal from "../../components/Cashier/BillModal";
import TableBillModal from "../../components/Cashier/TableBillModal";
import MenuAvailability from "../../components/Cashier/MenuAvailability";
import BillsHistory from "../../components/Cashier/BillsHistory";
import BillEditModal from "../../components/Cashier/BillEditModal";
import { registerNetwork } from "../../services/systemService";
import billingFormatService from "../../services/billingFormatService";
import kitchenFormatService from "../../services/kitchenFormatService";
import { printBill, DEFAULT_BILL_FORMAT } from "../../utils/billPrinter";
import { printKitchenTicket, DEFAULT_KITCHEN_FORMAT } from "../../utils/kitchenPrinter";

function Dashboard() {
    // ── State ───────────────────────────────────────────────────────
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);
    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [allItems, setAllItems] = useState([]);    // whole menu (search across categories)
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

    // Left sidebar + which full-screen view is showing.
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeView, setActiveView] = useState("dashboard");   // "dashboard" | "menu" | "bills"
    // Bills screen: a settled bill opened for correction + reprint.
    const [editingBill, setEditingBill] = useState(null);        // the bill row
    const [editingBillItems, setEditingBillItems] = useState([]);
    const [editingBillCharged, setEditingBillCharged] = useState(0);  // amount already taken
    const [billEditBusy, setBillEditBusy] = useState(false);
    // Guards order submission so a double-tap can't fire two orders.
    const [orderBusy, setOrderBusy] = useState(false);
    const [showBill, setShowBill] = useState(false);
    const [billData, setBillData] = useState(null);
    // Table bill (waiter-requested) review + payment
    const [showTableBill, setShowTableBill] = useState(false);
    const [tableBillTarget, setTableBillTarget] = useState(null);
    const [tableBillItems, setTableBillItems] = useState([]);
    const [tableBillBusy, setTableBillBusy] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [orderNumber, setOrderNumber] = useState(1001);
    const [cashierName] = useState("Cashier");
    const [currentDate, setCurrentDate] = useState("");
    const [currentTime, setCurrentTime] = useState("");
    const [billFormat, setBillFormat] = useState(DEFAULT_BILL_FORMAT);
    const [kitchenFormat, setKitchenFormat] = useState(DEFAULT_KITCHEN_FORMAT);
    const [restaurantInfo, setRestaurantInfo] = useState(null);

    // ── Functions ───────────────────────────────────────────────────
    function updateDateTime() {
        const now = new Date();
        setCurrentDate(now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }));
        setCurrentTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }

    const loadBillingFormat = async () => {
        try {
            const res = await billingFormatService.getBillingFormat();
            if (res.data?.success && res.data?.data) {
                if (res.data.data.format) setBillFormat(res.data.data.format);
                if (res.data.data.restaurant) setRestaurantInfo(res.data.data.restaurant);
            }
        } catch (e) {
            console.error("Failed to load bill format in cashier:", e);
        }
    };

    const loadKitchenFormat = async () => {
        try {
            const res = await kitchenFormatService.getKitchenFormat();
            if (res.data?.success && res.data?.data?.format) {
                setKitchenFormat(res.data.data.format);
            }
        } catch (e) {
            console.error("Failed to load kitchen format in cashier:", e);
        }
    };

    useEffect(() => {
        updateDateTime();
        loadTables();
        loadRunningOrders();
        loadCategories();
        loadAllItems();
        loadTodaysOrderCount();
        loadBillingFormat();
        loadKitchenFormat();

        // Register this restaurant's WAN IP so waiter phones on the same WiFi
        // are recognised as "on the restaurant network" (cloud model).
        const pingNetwork = () => { registerNetwork().catch(() => {}); };
        pingNetwork();
        const netTimer = setInterval(pingNetwork, 60000);

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
            clearInterval(netTimer);
            window.removeEventListener("focus", refreshOnFocus);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!selectedCategory) return;
        loadMenuItems(selectedCategory);
        // Poll so availability changes from another cashier/admin appear live.
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

    // Keep the current-order list in sync so items the kitchen (or waiter) marks
    // served flip to served here within a few seconds, no refresh needed.
    useEffect(() => {
        if (!selectedTable || selectedTable.status !== "OCCUPIED") return;
        const t = setInterval(() => refreshTableItems(selectedTable.id), 4000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTable]);

    // When searching, look across the WHOLE menu; otherwise the selected category.
    const term = searchTerm.trim().toLowerCase();
    const filteredItems = (term ? allItems : menuItems).filter((item) =>
        item.item_name.toLowerCase().includes(term)
    );

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
        // No table needed — a cart with no table selected is a counter/walk-in order.
        const limit = getItemQuantityLimit(item);
        const currentTotal = cart
            .filter((c) => c.id === item.id)
            .reduce((s, c) => s + normalizeQuantity(c.quantity), 0);
        if (currentTotal >= limit) {
            alert(`Only ${limit} items available.`);
            return;
        }
        // Merge into the NEW line with NO note (noted lines stay separate).
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

    // "−" on a menu card removes one unit from the no-note line for that item.
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

    const cartQtyFor = (itemId) =>
        cart.filter((c) => c.id === itemId).reduce((s, c) => s + normalizeQuantity(c.quantity), 0);

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
            // Keep the current tab on live re-polls; only default on first load.
            setSelectedCategory((cur) => cur || (res.data.data[0]?.id ?? null));
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
                const note = (it.note || "").trim();
                const k = `${it.id}|${note}`;   // same item + same note merges; different notes stay separate
                if (!acc[k]) {
                    acc[k] = {
                        menu_item_id: it.id,
                        item_name: it.item_name || it.name,
                        quantity: 0,
                        price: it.price,
                        gst: it.gst,
                        notes: note || null,
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
        if (orderBusy) return;
        if (cart.length === 0) { alert("Please add items."); return; }
        if (!selectedTable) { alert("Please select a table first."); return; }

        setOrderBusy(true);
        const orderData = {
            order_number: `ORD-${Date.now()}`,
            waiter_id: 1,
            table_id: selectedTable?.id || null,
            order_type: selectedTable?.isParcel ? "Takeaway" : "Dine-In",
            items: mergeCartItems(cart),
        };
        try {
            let assignedOrderNumber = orderData.order_number;
            if (editingOrder) {
                await updateOrder(editingOrder.id, orderData);
                assignedOrderNumber = editingOrder.order_number;
                alert(selectedTable?.isParcel ? "Parcel Order Updated" : "Order Updated Successfully");
                if (!selectedTable?.isParcel) {
                    setEditingOrder(null);
                }
            } else {
                const res = await createOrder(orderData);
                if (res.data?.data?.order_number) {
                    assignedOrderNumber = res.data.data.order_number;
                }
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

            // Print KOT to kitchen printer
            printKitchenTicket({
                order: {
                    order_number: assignedOrderNumber,
                    order_type: selectedTable?.isParcel ? "Takeaway" : "Dine-In",
                    isParcel: Boolean(selectedTable?.isParcel),
                    tableName: selectedTable?.isParcel ? "PARCEL" : `Table ${selectedTable.table_number}`,
                    table_number: selectedTable?.table_number,
                    items: orderData.items,
                    cashier_name: cashierName,
                    date: currentDate,
                    time: currentTime
                },
                restaurant: restaurantInfo || {},
                format: kitchenFormat || {}
            });

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

    const handleProceedToBilling = async () => {
        if (orderBusy) return;
        if (cart.length === 0) { alert("Please add items."); return; }

        let orderId = editingOrder?.id;
        let assignedOrderNumber = editingOrder ? editingOrder.order_number : `ORD-${orderNumber}`;

        // No existing order yet → create it now (this also sends it to the kitchen).
        if (!orderId) {
            setOrderBusy(true);
            const isTakeaway = !selectedTable || Boolean(selectedTable?.isParcel);
            const orderData = {
                order_number: `ORD-${Date.now()}`,
                waiter_id: 1,
                table_id: selectedTable?.id || null,
                order_type: isTakeaway ? "Takeaway" : "Dine-In",
                items: mergeCartItems(cart),
            };
            try {
                const res = await createOrder(orderData);
                orderId = res.data.data.order_id;
                assignedOrderNumber = res.data.data.order_number || orderData.order_number;
                if (selectedTable && selectedTable.id) {
                    await updateTableStatus(selectedTable.id, "OCCUPIED");
                }

                // Print KOT to kitchen printer
                printKitchenTicket({
                    order: {
                        order_number: assignedOrderNumber,
                        order_type: isTakeaway ? "Takeaway" : "Dine-In",
                        isParcel: isTakeaway,
                        tableName: selectedTable ? (selectedTable.isParcel ? "PARCEL" : `Table ${selectedTable.table_number}`) : "Counter",
                        table_number: selectedTable?.table_number,
                        items: orderData.items,
                        cashier_name: cashierName,
                        date: currentDate,
                        time: currentTime
                    },
                    restaurant: restaurantInfo || {},
                    format: kitchenFormat || {}
                });
            } catch (error) {
                console.error("Order Error:", error);
                alert(error.response?.data?.message || "Failed to place order.");
                setOrderBusy(false);
                return;
            } finally {
                setOrderBusy(false);
            }
        }

        const serviceCharge = subtotal * 0.02;

        setBillData({
            order_id: orderId,
            order_number: assignedOrderNumber,
            tableName: selectedTable ? (selectedTable.isParcel ? "PARCEL" : `Table ${selectedTable.table_number}`) : "Counter",
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
        setSelectedTable(null);
        setEditingOrder(null);
        alert("Bill Generated Successfully");
        updateDateTime();
        loadTables();
        loadRunningOrders();
        loadTodaysOrderCount();
    };

    // ── Table bill (waiter requested) — review / edit / take payment ──────
    const loadTableBillItems = async (tableId) => {
        try {
            const res = await getTableItems(tableId);
            setTableBillItems(
                (res.data.data || []).map((it) => ({
                    id: it.id, item_name: it.item_name,
                    quantity: Number(it.quantity), price: Number(it.price), served: Number(it.served),
                }))
            );
        } catch (e) { setTableBillItems([]); }
    };

    const openTableBill = async (table) => {
        setTableBillTarget(table);
        setShowTableBill(true);
        await loadTableBillItems(table.id);
    };

    const handleTableBillSetQty = async (rowId, qty) => {
        setTableBillBusy(true);
        try { await setItemQuantity(rowId, qty); await loadTableBillItems(tableBillTarget.id); }
        catch (e) { alert("Could not update the quantity."); }
        finally { setTableBillBusy(false); }
    };

    const handleTableBillRemove = async (rows) => {
        if (!window.confirm(`Remove ${rows[0]?.item_name || "this item"} from the bill?`)) return;
        setTableBillBusy(true);
        try { for (const r of rows) await cancelItem(r.id); await loadTableBillItems(tableBillTarget.id); }
        catch (e) { alert("Could not remove the item."); }
        finally { setTableBillBusy(false); }
    };

    const handleTableBillAdd = async (menuItem) => {
        setTableBillBusy(true);
        try { await addBillItem(tableBillTarget.id, menuItem.id, 1); await loadTableBillItems(tableBillTarget.id); }
        catch (e) { alert("Could not add the item."); }
        finally { setTableBillBusy(false); }
    };

    // Cashier can mark an item served from inside the bill modal.
    const handleTableBillServe = async (rows) => {
        const list = Array.isArray(rows) ? rows : [rows];
        setTableBillBusy(true);
        try {
            await Promise.all(list.map((r) => markItemServed(r.id)));
            await loadTableBillItems(tableBillTarget.id);
        }
        catch (e) { alert("Could not mark the item as served."); }
        finally { setTableBillBusy(false); }
    };

    // ── Bills screen: correct a settled bill, then reprint ───────────────
    const openBillForEdit = async (bill) => {
        setEditingBill(bill);
        setEditingBillCharged(Number(bill.paid_amount || bill.grand_total || 0));
        setEditingBillItems([]);
        // The menu is needed for "add a missed item".
        if (allItems.length === 0) loadAllItems();
        await refreshBillItems(bill.id);
    };

    const refreshBillItems = async (orderId) => {
        try {
            const res = await getOrderDetails(orderId);
            setEditingBillItems(res.data.data || []);
        } catch (e) {
            console.error("Bill items error:", e);
            alert("Could not load this bill's items.");
        }
    };

    const handleBillSetQty = async (itemId, quantity) => {
        setBillEditBusy(true);
        try {
            await setItemQuantity(itemId, quantity);
            await refreshBillItems(editingBill.id);
        } catch (e) {
            alert("Could not change the quantity.");
        } finally {
            setBillEditBusy(false);
        }
    };

    const handleBillRemove = async (rows) => {
        if (!window.confirm(`Remove ${rows[0]?.item_name || "this item"} from this bill?`)) return;
        setBillEditBusy(true);
        try {
            for (const r of rows) await cancelItem(r.id);
            await refreshBillItems(editingBill.id);
        } catch (e) {
            alert("Could not remove the item.");
        } finally {
            setBillEditBusy(false);
        }
    };

    const handleBillAdd = async (menuItem) => {
        setBillEditBusy(true);
        try {
            await addItemToOrder(editingBill.id, menuItem.id, 1);
            await refreshBillItems(editingBill.id);
        } catch (e) {
            alert("Could not add the item.");
        } finally {
            setBillEditBusy(false);
        }
    };

    // Save the corrected totals (syncing the recorded payment) and reprint.
    const handleBillReprint = async (method, totals) => {
        setBillEditBusy(true);
        try {
            const res = await rebillOrder(editingBill.id, method);
            const result = res.data.data;

            // Re-read the header so the receipt shows the stored figures.
            let header = editingBill;
            try {
                header = (await getBill(editingBill.id)).data.data;
            } catch (e) {
                console.error("Bill header reload failed, printing from screen:", e);
            }

            const opened = printCorrectedBill({
                title: header.restaurant_name || restaurantInfo?.restaurant_name || "InWallz",
                billNumber: header.order_number,
                place: header.table_name ? `Table ${header.table_name}` : "Counter",
                items: editingBillItems,
                subtotal: totals.subtotal,
                gst: totals.gst,
                service: totals.service,
                total: totals.total,
                method,
                isReprint: true
            });

            if (!opened) alert("Bill saved, but the print window was blocked. Allow pop-ups to print.");

            const diff = Number(result.difference || 0);
            if (Math.abs(diff) >= 0.01) {
                alert(
                    diff > 0
                        ? `Bill corrected. Collect ₹${diff.toFixed(2)} more from the customer.`
                        : `Bill corrected. Refund ₹${Math.abs(diff).toFixed(2)} to the customer.`
                );
            }

            closeBillEdit();
            await loadTodaysOrderCount();
        } catch (e) {
            console.error("Rebill error:", e);
            alert(e.response?.data?.message || "Could not save the corrected bill.");
        } finally {
            setBillEditBusy(false);
        }
    };

    const closeBillEdit = () => {
        setEditingBill(null);
        setEditingBillItems([]);
        setEditingBillCharged(0);
    };

    // Print the receipt (with the chosen payments) and settle the table.
    // `payments` is an array of { method, amount } supporting split payments.
    const generateTableBill = async (payments, finalTotal, selectedCharges = []) => {
        const table = tableBillTarget;
        setTableBillBusy(true);
        try {
            const items = tableBillItems;
            // Rounds to paise the same way backend/utils/billing.js does, so the
            // printed receipt and the stored order can never disagree.
            const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
            const paymentList = Array.isArray(payments) ? payments : [{ method: payments, amount: finalTotal }];
            const primaryMethod = paymentList[0]?.method || "Cash";
            const sub = money(items.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0));
            const gstAmt = money(sub * 0.05);
            const svc = money(sub * 0.02);

            // Per-bill charges (packing, delivery, …) resolve to rupees here so
            // the receipt and the total agree on one number each.
            const resolvedCharges = selectedCharges.map((c) => ({
                charge_name: c.charge_name,
                amount: c.charge_type === "Percentage"
                    ? money(sub * c.amount / 100)
                    : money(c.amount)
            }));
            const chargesTotal = money(
                resolvedCharges.reduce((s, c) => s + c.amount, 0)
            );

            const total = finalTotal || money(sub + gstAmt + svc + chargesTotal);

            // Print the receipt using the admin-configured bill format.
            printBill({
                order: {
                    order_number: `TBL-${table.table_number}-${Date.now().toString().slice(-4)}`,
                    tableName: `Table ${table.table_number}`,
                    table_number: table.table_number,
                    items: items,
                    subtotal: sub,
                    tax: gstAmt,
                    service_charge: svc,
                    charges: resolvedCharges,
                    grand_total: total,
                    payment_method: primaryMethod,
                    payments: paymentList,
                    cashier_name: cashierName,
                    date: currentDate,
                    time: currentTime
                },
                restaurant: restaurantInfo || {},
                format: billFormat || {}
            });

            // Pass the payments through — settleTable records each split as a
            // separate payment row. finalTotal includes per-bill charges (which
            // are not part of the stored order grand_total), so the backend
            // validates and records against the same number the cashier sees.
            await settleTable(table.id, paymentList, total);
            const label = paymentList.length > 1
                ? paymentList.map((p) => p.method).join(" + ")
                : primaryMethod;
            alert(`Table ${table.table_number} billed (${label}) & settled — now Available.`);
            setShowTableBill(false);
            setTableBillTarget(null);
            setTableBillItems([]);
            setSelectedTable(null);
            await loadTables();
            await loadRunningOrders();
            await loadTodaysOrderCount();
        } catch (e) {
            alert("Could not generate the bill.");
        } finally {
            setTableBillBusy(false);
        }
    };

    // ── UI computed values ──────────────────────────────────────────
    const availableCount = tables.filter((t) => t.status === "FREE").length;
    const serviceCharge  = subtotal * 0.02;
    const displayTotal   = grandTotal + serviceCharge;
    const billTables     = tables
        .filter((t) => t.needs_bill)
        .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));

    // ── Render (desktop POS) ────────────────────────────────────────
    return (
        <div className="cashier-app pos">

            {/* ══ LEFT SIDEBAR (drawer) ══ */}
            {sidebarOpen && <div className="pos-scrim" onClick={() => setSidebarOpen(false)} />}
            <aside className={`pos-drawer${sidebarOpen ? " open" : ""}`}>
                <div className="pos-drawer-head">
                    <span className="pos-drawer-logo">InWallz POS</span>
                    <button className="pos-drawer-x" onClick={() => setSidebarOpen(false)}>✕</button>
                </div>
                <nav className="pos-nav">
                    <button
                        className={`pos-nav-item${activeView === "dashboard" ? " active" : ""}`}
                        onClick={() => { setActiveView("dashboard"); setSidebarOpen(false); }}
                    >
                        🧾 Dashboard
                    </button>
                    <button
                        className={`pos-nav-item${activeView === "menu" ? " active" : ""}`}
                        onClick={() => { setActiveView("menu"); setSidebarOpen(false); }}
                    >
                        🍽 Menu
                    </button>
                    <button
                        className={`pos-nav-item${activeView === "bills" ? " active" : ""}`}
                        onClick={() => { setActiveView("bills"); setSidebarOpen(false); }}
                    >
                        🧾 Bills
                    </button>
                </nav>
            </aside>

            {/* ══ TOP BAR ══ */}
            <header className="pos-topbar">
                <button className="pos-hamburger" onClick={() => setSidebarOpen((o) => !o)} title="Menu">
                    <span /><span /><span />
                </button>
                <div className="pos-brand">
                    <span className="pos-logo">The InWallz</span>
                    <span className="pos-open">● Open</span>
                </div>
                <div className="pos-stats">
                    <span className="pos-stat"><b>{todayOrders}</b> Today's</span>
                    <span className="pos-stat"><b>{runningOrders.length}</b> Active</span>
                    <span className="pos-stat"><b>{availableCount}</b> Free</span>
                </div>

                <div className="pos-topactions">
                    <button className="pos-bell" onClick={openRunningOrders} title="Running orders">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                        {runningOrders.length > 0 && <span className="pos-bell-dot">{runningOrders.length}</span>}
                    </button>
                    <div className="pos-time"><span className="pos-clock">{currentTime}</span><span className="pos-date">{currentDate}</span></div>
                    <div className="pos-user">
                        <div className="pos-avatar">{cashierName.charAt(0)}</div>
                        <div className="pos-user-info"><span className="pos-user-name">{cashierName}</span><span className="pos-user-id">C101</span></div>
                    </div>
                    <button className="pos-logout" onClick={handleLogout}>Logout</button>
                </div>
            </header>

            {activeView === "menu" ? <MenuAvailability /> :
             activeView === "bills" ? <BillsHistory onOpenBill={openBillForEdit} /> : (
            <>
            {/* ══ TABLE BAR ══ */}
            <div className="pos-tablebar">
                <span className="pos-tablebar-label">Tables</span>
                <div className="pos-tables">
                    {tables.map((table) => {
                        const isFree = table.status === "FREE";
                        const isBilled = table.needs_bill;
                        const isSel = selectedTable?.id === table.id;
                        const cls = isFree ? "free" : isBilled ? "billed" : "occ";
                        return (
                            <button key={table.id} className={`pos-tchip ${cls}${isSel ? " sel" : ""}`} onClick={() => handleSelectTable(table)}>
                                <span className="pos-tchip-name">T{table.table_number}</span>
                                <span className="pos-tchip-state">{isFree ? "Free" : isBilled ? "Billed" : "Occupied"}</span>
                                {Number(table.total_items) > 0 && (
                                    <span className="pos-tchip-served">{Number(table.served_items)}/{Number(table.total_items)}</span>
                                )}
                            </button>
                        );
                    })}
                    <button className={`pos-tchip counter${!selectedTable ? " sel" : ""}`} onClick={handleChangeTable} title="Order without a table">
                        <span className="pos-tchip-name">🧾</span>
                        <span className="pos-tchip-state">Counter</span>
                    </button>
                </div>
            </div>

            {/* ══ BILLS TO PRINT (waiter requests) ══ */}
            {billTables.length > 0 && (
                <div className="pos-printalert">
                    <span className="pos-printalert-title">🔔 Bills to print:</span>
                    {billTables.map((t) => (
                        <button key={t.id} className="pos-printalert-btn" onClick={() => openTableBill(t)}>
                            🧾 Bill T{t.table_number}
                        </button>
                    ))}
                </div>
            )}

            {/* ══ BODY: menu (left) + docked bill (right) ══ */}
            <div className="pos-body">

                {/* MENU */}
                <div className="pos-menu">
                    <div className="pos-menu-top">
                        <div className="pos-search">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" placeholder="Search menu items..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <CategoryTabs categories={categories} selectedCategory={selectedCategory} onSelectCategory={(id) => { setSearchTerm(""); setSelectedCategory(id); }} />
                    <div className="pos-menu-grid">
                        {filteredItems.length === 0 ? (
                            <p className="pos-noitems">No items available</p>
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

                {/* DOCKED BILL PANEL */}
                <aside className="pos-bill">
                    <div className="pos-bill-head">
                        <div className="pos-bill-headtext">
                            <span className="pos-bill-title">
                                {selectedTable ? `Table ${selectedTable.table_number}` : "🧾 Counter Order"}
                            </span>
                            <span className="pos-bill-sub">{editingOrder ? editingOrder.order_number : (selectedTable ? "New order" : "Walk-in — no table")}</span>
                        </div>
                        <div className="pos-bill-headbtns">
                            {selectedTable && <button className="pos-bill-change" onClick={handleChangeTable} title="Change table">Change</button>}
                            {cart.length > 0 && <button className="pos-bill-clear" onClick={clearCart} title="Clear new items">✕</button>}
                        </div>
                    </div>

                    <div className="pos-bill-scroll">
                        {/* Current unpaid order for the table */}
                        {previousItems.length > 0 && (
                            <div className="pos-prev">
                                <div className="pos-prev-label">Current order (unpaid)</div>
                                {previousItems.map((it) => (
                                    <div key={it.id} className={`pos-prev-row${it.served ? " served" : ""}`}>
                                        <span className="pos-prev-name">{it.quantity}× {it.item_name}</span>
                                        {it.served
                                            ? <span className="pos-prev-served">✓ Served</span>
                                            : <button className="pos-prev-serve" onClick={() => handleServeItem(it)}>Serve</button>}
                                    </div>
                                ))}
                                <button className="pos-print-settle" onClick={() => openTableBill(selectedTable)}>🧾 Generate Bill</button>
                                <div className="pos-prev-divider">＋ New items (new kitchen ticket)</div>
                            </div>
                        )}

                        {/* New items being added */}
                        {cart.length === 0 ? (
                            <div className="pos-bill-empty">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                                <p>Add items from the menu</p>
                            </div>
                        ) : (
                            cart.map((item) => (
                                <CartItem key={item.lineId} item={item} increaseQuantity={increaseQuantity} decreaseQuantity={decreaseQuantity} removeItem={removeItem} setNote={setLineNote} />
                            ))
                        )}
                    </div>

                    {/* Totals + actions (always docked at the bottom) */}
                    <div className="pos-bill-foot">
                        <div className="pos-tot-row"><span>Subtotal</span><span>₹{subtotal.toFixed(0)}</span></div>
                        <div className="pos-tot-row"><span>GST (5%)</span><span>₹{gst.toFixed(0)}</span></div>
                        <div className="pos-tot-row"><span>Service (2%)</span><span>₹{serviceCharge.toFixed(0)}</span></div>
                        <div className="pos-tot-row grand"><span>Total</span><span>₹{displayTotal.toFixed(0)}</span></div>
                        <div className="pos-bill-actions">
                            {selectedTable && (
                                <button className="pos-send" onClick={placeOrder} disabled={cart.length === 0 || orderBusy}>
                                    {orderBusy ? "Sending..." : editingOrder ? "Update Order" : "Send to Kitchen"}
                                </button>
                            )}
                            <button className="pos-pay" onClick={handleProceedToBilling} disabled={cart.length === 0 || orderBusy}>
                                {orderBusy ? "Processing..." : selectedTable ? "Proceed to Billing →" : "Send & Bill →"}
                            </button>
                        </div>
                        {editingOrder && selectedTable && <button className="pos-cancel" onClick={handleCancelOrder}>✕ Cancel Order</button>}
                    </div>
                </aside>
            </div>
            </>
            )}

            {/* Modals */}
            {showRunningOrders && (
                <RunningOrders runningOrders={runningOrders} closeOrders={() => setShowRunningOrders(false)} openOrder={openOrder} />
            )}
            {showTableBill && tableBillTarget && (
                <TableBillModal
                    table={tableBillTarget}
                    items={tableBillItems}
                    menuItems={allItems}
                    busy={tableBillBusy}
                    onSetQty={handleTableBillSetQty}
                    onRemoveGroup={handleTableBillRemove}
                    onAddItem={handleTableBillAdd}
                    onServe={handleTableBillServe}
                    onGenerate={generateTableBill}
                    onClose={() => { setShowTableBill(false); setTableBillTarget(null); setTableBillItems([]); }}
                />
            )}
            {showBill && billData && (
                <BillModal
                    order={billData}
                    restaurant={restaurantInfo}
                    format={billFormat}
                    onClose={() => setShowBill(false)}
                    onSuccess={handlePaymentSuccess}
                />
            )}
            {editingBill && (
                <BillEditModal
                    bill={editingBill}
                    items={editingBillItems}
                    menuItems={allItems}
                    busy={billEditBusy}
                    chargedTotal={editingBillCharged}
                    onSetQty={handleBillSetQty}
                    onRemoveGroup={handleBillRemove}
                    onAddItem={handleBillAdd}
                    onReprint={handleBillReprint}
                    onClose={closeBillEdit}
                />
            )}
        </div>
    );
}

export default Dashboard;

