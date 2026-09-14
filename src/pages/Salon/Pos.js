import { useEffect, useRef, useState } from "react";

import DayControl from "../../components/DayControl";
import authService from "../../services/authService";
import { getCategories, getItemsByCategory, getAllItems } from "../../services/menuService";
import {
    createOrder,
    cancelOrder,
    getOrderDetails,
    getTodaysOrderCount,
    getBill,
    addItemToOrder,
    rebillOrder,
    setItemQuantity,
    cancelItem
} from "../../services/orderService";
import { searchCustomers, resolveCustomer } from "../../services/customerService";
import { getStylists } from "../../services/stylistService";
import settingsService from "../../services/settingsService";
import billingFormatService from "../../services/billingFormatService";
import chargeService from "../../services/chargeService";

import CategoryTabs from "../../components/Waiter/CategoryTabs";
import MenuCard from "../../components/Waiter/MenuCard";
import CartItem from "../../components/Waiter/CartItem";
import BillModal from "../../components/Cashier/BillModal";
import BillsHistory from "../../components/Cashier/BillsHistory";
import BillEditModal from "../../components/Cashier/BillEditModal";
import MenuAvailability from "../../components/Cashier/MenuAvailability";
import PrinterSetup from "../../components/Cashier/PrinterSetup";

import { DEFAULT_BILL_FORMAT } from "../../utils/billPrinter";
import { printBill as printCorrectedBill } from "../../utils/printBill";
import { billTotals, autoChargesFor, resolveDiscount } from "../../utils/rates";
import { salonBillFormat } from "../../utils/businessType";
import {
    whatsappNumber,
    billFromPrintedOrder,
    billFromSaved,
    buildBillMessage,
    normalizeBillDelivery,
    whatsappUrl,
    openWhatsApp,
    getWhatsAppOverride,
    setWhatsAppOverride,
    effectiveVia
} from "../../utils/whatsappBill";
import usePersistentCart from "../../hooks/usePersistentCart";

import "../../styles/pages/Cashier/Dashboard.css";
import "../../styles/pages/Salon/Salon.css";

/*
| The salon front desk.
|
| The restaurant till is built around tables, kitchen tickets and a waiter floor;
| a salon has none of that. Here the receptionist picks services, puts the
| customer on the bill (mobile number and name are required — existing customers
| are suggested while typing), takes payment and prints.
|
| Everything underneath is the counter flow the cashier already uses — a
| Takeaway order, the same bill modal, charges, printing, bill corrections — so
| the money path is the one that's already been proven, not a second copy of it.
*/

// Every salon bill is a counter bill (the backend enforces this too).
const ORDER_TYPE = "Takeaway";
const MOBILE_RE = /^[0-9]{10}$/;

const VIEWS = [
    { key: "billing", label: "🧾 Billing" },
    { key: "services", label: "✂ Services" },
    { key: "bills", label: "📋 Bills" },
    { key: "printer", label: "🖨 Printer" }
];

const dateParts = (d = new Date()) => ({
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
});

function SalonPos() {

    const currentUser = authService.getUser();
    const receptionistName = currentUser?.full_name || currentUser?.username || "Reception";

    // ── Catalogue ───────────────────────────────────────────────────
    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [allItems, setAllItems] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    // ── Bill in progress ────────────────────────────────────────────
    // Survives a refresh (hooks/usePersistentCart).
    const [cart, setCart] = usePersistentCart("inwallz_cart_salon");
    const [charges, setCharges] = useState([]);
    const [billFormat, setBillFormat] = useState(DEFAULT_BILL_FORMAT);
    const [salonInfo, setSalonInfo] = useState(null);
    const [busy, setBusy] = useState(false);
    const [billData, setBillData] = useState(null);
    const [notice, setNotice] = useState("");

    // ── WhatsApp bill (click-to-chat) ───────────────────────────────
    // waBill: the last paid bill, ready to send — { number, customer, phone, text,
    // opened, blocked }. Preferences belong to this PC (utils/whatsappBill.js).
    const [waBill, setWaBill] = useState(null);
    // This till's override ("web" | "app" | null). null = follow the salon
    // default (settings.whatsapp_via, in `desk` below).
    const [waOverride, setWaOverride] = useState(getWhatsAppOverride);
    // The Web/App switch stays tucked behind a "Change" link so it isn't in the
    // way on every bill, but is one tap away when a till needs to switch.
    const [showWaSwitch, setShowWaSwitch] = useState(false);
    // The owner's choices (Settings → Bills & WhatsApp) and the shop number given
    // when the salon was created — polled with the discount rule.
    const [desk, setDesk] = useState({ bill_delivery: "printer_optional", whatsapp_template: "", shop_mobile: "", whatsapp_via: "web" });

    // The unpaid order already created for the bill on screen. Closing the bill
    // modal without taking payment and pressing Bill again must not ring up a
    // second order for the same visit.
    const pendingRef = useRef(null);   // { id, order_number, key }

    // ── Customer ────────────────────────────────────────────────────
    const [mobile, setMobile] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [customer, setCustomer] = useState(null);   // { id, customer_name, mobile, is_new? }
    // Existing customers matching what's being typed, and which box they belong to.
    const [suggestions, setSuggestions] = useState([]);
    const [suggestFor, setSuggestFor] = useState(null);   // "mobile" | "name" | null
    const [highlight, setHighlight] = useState(0);
    // A full 10-digit number that was searched and belongs to nobody yet.
    const [newNumber, setNewNumber] = useState("");

    // ── Stylist (required on every bill) ────────────────────────────
    const [stylists, setStylists] = useState([]);
    const [stylistId, setStylistId] = useState("");

    // ── Discount (only if the owner allows it, within their limits) ─
    const [discountPolicy, setDiscountPolicy] = useState({ enabled: false, max_percent: 0, max_amount: 0 });
    const [discountType, setDiscountType] = useState("percent");   // "percent" | "amount"
    const [discountValue, setDiscountValue] = useState("");

    // ── Screen ──────────────────────────────────────────────────────
    const [todayBills, setTodayBills] = useState(0);
    const [now, setNow] = useState(new Date());
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeView, setActiveView] = useState("billing");

    // ── Bills screen: correct a settled bill, then reprint ──────────
    const [editingBill, setEditingBill] = useState(null);
    const [editingBillItems, setEditingBillItems] = useState([]);
    const [editingBillCharged, setEditingBillCharged] = useState(0);
    const [billEditBusy, setBillEditBusy] = useState(false);

    // ── Loaders ─────────────────────────────────────────────────────
    const loadCategories = async () => {
        try {
            const res = await getCategories();
            const list = res.data.data || [];
            setCategories(list);
            // Keep the current tab on re-polls; default to the first on load.
            setSelectedCategory((cur) => (cur && list.some((c) => c.id === cur) ? cur : (list[0]?.id ?? null)));
        } catch (e) { console.error(e); }
    };

    const loadMenuItems = async (categoryId) => {
        try {
            const res = await getItemsByCategory(categoryId);
            setMenuItems(res.data.data || []);
        } catch (e) { console.error(e); }
    };

    const loadAllItems = async () => {
        try {
            const res = await getAllItems();
            setAllItems(res.data.data || []);
        } catch (e) { console.error(e); }
    };

    const loadTodayCount = async () => {
        try {
            const res = await getTodaysOrderCount();
            setTodayBills(Number(res.data.data) || 0);
        } catch (e) { console.error(e); }
    };

    const loadCharges = async () => {
        try {
            const res = await chargeService.getCharges();
            if (res.data?.success) setCharges(res.data.data || []);
        } catch (e) {
            // Bill the services rather than block the desk — a missing GST line
            // is visible on screen.
            console.error("Failed to load charges:", e);
        }
    };

    // The owner's discount rule (Settings → Discounts), synced to this till.
    const loadDiscountPolicy = async () => {
        try {
            const res = await settingsService.getRestaurant();
            const s = res.data?.data || {};
            setDiscountPolicy({
                enabled: Boolean(Number(s.discount_enabled)),
                max_percent: Number(s.discount_max_percent) || 0,
                max_amount: Number(s.discount_max_amount) || 0
            });
            setDesk({
                bill_delivery: normalizeBillDelivery(s.bill_delivery),
                whatsapp_template: s.whatsapp_template || "",
                shop_mobile: s.shop_mobile || "",
                whatsapp_via: s.whatsapp_via === "app" ? "app" : "web"
            });
        } catch (e) {
            console.error("Failed to load the discount rule:", e);
        }
    };

    const loadStylists = async () => {
        try {
            const res = await getStylists();
            const list = res.data.data || [];
            setStylists(list);
            // A stylist the owner removed or deactivated can't stay picked.
            setStylistId((cur) => (list.some((s) => String(s.id) === cur) ? cur : ""));
        } catch (e) {
            console.error("Failed to load stylists:", e);
        }
    };

    const loadBillingFormat = async () => {
        try {
            const res = await billingFormatService.getBillingFormat();
            if (res.data?.success && res.data?.data) {
                if (res.data.data.format) setBillFormat(res.data.data.format);
                if (res.data.data.restaurant) setSalonInfo(res.data.data.restaurant);
            }
        } catch (e) {
            console.error("Failed to load bill format:", e);
        }
    };

    useEffect(() => {
        loadCategories();
        loadAllItems();
        loadTodayCount();
        loadCharges();
        loadStylists();
        loadDiscountPolicy();
        loadBillingFormat();

        // Pick up services, prices and charges the owner changes (and the cloud
        // syncs down) without a refresh.
        const poll = setInterval(() => {
            loadCategories();
            loadAllItems();
            loadTodayCount();
            loadCharges();
            loadStylists();
            loadDiscountPolicy();
        }, 10000);
        const clock = setInterval(() => setNow(new Date()), 30000);

        return () => {
            clearInterval(poll);
            clearInterval(clock);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!selectedCategory) return undefined;
        loadMenuItems(selectedCategory);
        const t = setInterval(() => loadMenuItems(selectedCategory), 10000);
        return () => clearInterval(t);
    }, [selectedCategory]);

    // The WhatsApp panel belongs to the bill just paid; starting the next
    // customer's bill puts it away.
    const hasCart = cart.length > 0;
    useEffect(() => {
        if (hasCart) setWaBill(null);
    }, [hasCart]);

    // A notice clears itself.
    useEffect(() => {
        if (!notice) return undefined;
        const t = setTimeout(() => setNotice(""), 5000);
        return () => clearTimeout(t);
    }, [notice]);

    // Suggest existing customers as the mobile number or name is typed. A short
    // pause first, so a fast typist fires one search rather than ten.
    useEffect(() => {
        if (customer || !suggestFor) {
            setSuggestions([]);
            return undefined;
        }

        const term = suggestFor === "mobile" ? mobile : customerName.trim();
        if (term.length < (suggestFor === "mobile" ? 3 : 2)) {
            setSuggestions([]);
            return undefined;
        }

        let live = true;
        const timer = setTimeout(() => {
            searchCustomers(term)
                .then((res) => {
                    if (!live) return;
                    const list = res.data.data || [];

                    if (suggestFor === "mobile" && MOBILE_RE.test(term)) {
                        // The whole number of someone already on file: that's them.
                        const exact = list.find((c) => c.mobile === term);
                        if (exact) {
                            pickCustomer(exact);
                            return;
                        }
                        setNewNumber(term);
                    }

                    setSuggestions(list);
                    setHighlight(0);
                })
                .catch(() => { if (live) setSuggestions([]); });
        }, 250);

        return () => {
            live = false;
            clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mobile, customerName, suggestFor, customer]);

    // ── Services grid ───────────────────────────────────────────────
    // Searching looks across every category; otherwise the selected one.
    const term = searchTerm.trim().toLowerCase();
    const visibleItems = (term ? allItems : menuItems).filter((item) =>
        String(item.item_name || "").toLowerCase().includes(term)
    );

    // ── Cart ────────────────────────────────────────────────────────
    // One line per service; a salon has no per-line kitchen notes.
    const addToCart = (item) => {
        setCart((prev) => {
            const idx = prev.findIndex((c) => c.id === item.id);
            if (idx === -1) {
                return [...prev, {
                    id: item.id,
                    item_name: item.item_name,
                    price: Number(item.price),
                    quantity: 1,
                    isNew: false,
                    lineId: `svc-${item.id}`
                }];
            }
            const copy = [...prev];
            copy[idx] = { ...copy[idx], quantity: Number(copy[idx].quantity) + 1 };
            return copy;
        });
    };

    const changeQuantity = (lineId, delta) => {
        setCart((prev) =>
            prev
                .map((c) => (c.lineId === lineId ? { ...c, quantity: Number(c.quantity) + delta } : c))
                .filter((c) => c.quantity > 0)
        );
    };

    const removeOneFromCart = (item) => changeQuantity(`svc-${item.id}`, -1);
    const removeLine = (lineId) => setCart((prev) => prev.filter((c) => c.lineId !== lineId));
    const cartQtyFor = (itemId) => cart.filter((c) => c.id === itemId).reduce((s, c) => s + Number(c.quantity), 0);

    // Same calculation the backend runs (utils/rates mirrors backend/utils/billing.js).
    const subtotal = cart.reduce((s, it) => s + Number(it.price) * Number(it.quantity), 0);

    // The discount typed in, checked against the owner's rule — the backend
    // checks it again when the bill is created. It comes off the services before
    // GST, the same order backend/utils/billing.js uses.
    const percentAllowed = discountPolicy.enabled && discountPolicy.max_percent > 0;
    const amountAllowed = discountPolicy.enabled && discountPolicy.max_amount > 0;
    const activeDiscountType = discountType === "percent"
        ? (percentAllowed ? "percent" : "amount")
        : (amountAllowed ? "amount" : "percent");
    const discountNumber = Number(discountValue);
    const discountEntered = discountPolicy.enabled && discountValue !== "" && discountNumber !== 0;

    let discountProblem = "";
    if (discountEntered) {
        if (!Number.isFinite(discountNumber) || discountNumber < 0) {
            discountProblem = "Enter a valid discount.";
        } else if (activeDiscountType === "percent" && discountNumber > discountPolicy.max_percent) {
            discountProblem = `The owner allows up to ${discountPolicy.max_percent}% off.`;
        } else if (activeDiscountType === "amount" && discountNumber > discountPolicy.max_amount) {
            discountProblem = `The owner allows up to ₹${discountPolicy.max_amount} off.`;
        } else if (activeDiscountType === "amount" && discountNumber > subtotal) {
            discountProblem = "The discount can't be more than the bill.";
        }
    }

    const discount = discountEntered && !discountProblem
        ? resolveDiscount(subtotal, activeDiscountType === "percent"
            ? { percent: discountNumber }
            : { amount: discountNumber })
        : 0;
    const discountLabel = activeDiscountType === "percent" ? `Discount (${discountNumber}%)` : "Discount";

    const cartTotals = billTotals(subtotal, autoChargesFor(charges, ORDER_TYPE), discount);
    const lineCharges = [...cartTotals.tax_lines, ...cartTotals.service_lines, ...cartTotals.charge_lines];

    // ── Customer ────────────────────────────────────────────────────
    const pickCustomer = (c) => {
        setCustomer(c);
        setMobile(c.mobile);
        setCustomerName(c.customer_name);
        setSuggestions([]);
        setSuggestFor(null);
        setNewNumber("");
    };

    const onMobileChange = (value) => {
        setMobile(value.replace(/[^0-9]/g, "").slice(0, 10));
        setCustomer(null);
        setNewNumber("");
        setSuggestFor("mobile");
    };

    const onNameChange = (value) => {
        setCustomerName(value);
        setCustomer(null);
        setSuggestFor("name");
    };

    const clearCustomer = () => {
        setMobile("");
        setCustomerName("");
        setCustomer(null);
        setSuggestions([]);
        setSuggestFor(null);
        setNewNumber("");
    };

    // ↑ ↓ to move through the suggestions, Enter to pick, Esc to close.
    const onSuggestKey = (e) => {
        if (!suggestions.length) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % suggestions.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            pickCustomer(suggestions[highlight] || suggestions[0]);
        } else if (e.key === "Escape") {
            setSuggestFor(null);
        }
    };

    // The customer this bill is for — picked from the suggestions, or saved now
    // from the mobile number and name typed in. Every bill carries one.
    const ensureCustomer = async () => {
        if (customer && customer.mobile === mobile) return customer;

        if (!MOBILE_RE.test(mobile)) throw new Error("Enter the customer's 10-digit mobile number.");

        const name = customerName.trim();
        if (!name) throw new Error("Enter the customer's name.");

        // Finds them by mobile if they're already on file, otherwise adds them.
        const res = await resolveCustomer({ mobile, customer_name: name });
        const resolved = res.data.data;
        setCustomer(resolved);
        return resolved;
    };

    const renderSuggestions = (field) =>
        suggestFor === field && suggestions.length > 0 && (
            <ul className="sl-suggest" role="listbox" id={`sl-suggest-${field}`}>
                {suggestions.map((c, i) => (
                    <li
                        key={c.id}
                        role="option"
                        aria-selected={i === highlight}
                        className={i === highlight ? "active" : ""}
                        // mousedown, not click: it lands before the input's blur
                        // closes the list.
                        onMouseDown={(e) => { e.preventDefault(); pickCustomer(c); }}
                        onMouseEnter={() => setHighlight(i)}
                    >
                        <span className="sl-suggest-name">{c.customer_name}</span>
                        <span className="sl-suggest-mobile">{c.mobile}</span>
                    </li>
                ))}
            </ul>
        );

    // ── Billing ─────────────────────────────────────────────────────
    const discardPending = async () => {
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (!pending) return;
        try {
            await cancelOrder(pending.id);
        } catch (e) {
            // Left unpaid in Bills if it can't be cancelled; nothing was charged.
            console.error("Could not cancel the superseded bill:", e);
        }
    };

    const clearBill = async () => {
        if (cart.length && !window.confirm("Clear this bill?")) return;
        setCart([]);
        clearCustomer();
        setStylistId("");
        setDiscountValue("");
        await discardPending();
    };

    const handleBill = async () => {
        if (busy) return;
        if (cart.length === 0) { alert("Add at least one service."); return; }

        if (discountProblem) { alert(discountProblem); return; }

        // Checked before the customer is saved, so a missing stylist never
        // leaves a half-made bill behind.
        const stylist = stylists.find((s) => String(s.id) === stylistId);
        if (!stylist) { alert("Choose the stylist for this bill."); return; }

        setBusy(true);
        try {
            const cust = await ensureCustomer();

            const items = cart.map((it) => ({
                menu_item_id: it.id,
                item_name: it.item_name,
                quantity: Number(it.quantity),
                price: Number(it.price)
            }));

            // Reuse the unpaid order when nothing about the bill has changed;
            // otherwise cancel it and ring up a fresh one.
            const key = JSON.stringify({
                c: cust ? cust.id : null,
                s: stylist.id,
                d: discount > 0 ? [activeDiscountType, discountNumber] : null,
                i: items.map((i) => [i.menu_item_id, i.quantity])
            });
            if (pendingRef.current && pendingRef.current.key !== key) {
                await discardPending();
            }
            if (!pendingRef.current) {
                const res = await createOrder({
                    table_id: null,
                    order_type: ORDER_TYPE,
                    customer_id: cust ? cust.id : null,
                    stylist_id: stylist.id,
                    discount_type: discount > 0 ? activeDiscountType : null,
                    discount_value: discount > 0 ? discountNumber : null,
                    items
                });
                pendingRef.current = {
                    id: res.data.data.order_id,
                    order_number: res.data.data.order_number,
                    key
                };
            }

            const { date, time } = dateParts();

            setBillData({
                order_id: pendingRef.current.id,
                order_number: pendingRef.current.order_number,
                placeLabel: "Customer",
                tableName: cust ? `${cust.customer_name} · ${cust.mobile}` : "Walk-in",
                isCounter: true,
                customer_name: cust ? cust.customer_name : "",
                customer_mobile: cust ? cust.mobile : "",
                stylist_name: stylist.full_name,
                cashier_name: receptionistName,
                cashier_label: "Receptionist",
                date,
                time,
                items,
                subtotal: Number(subtotal.toFixed(2)),
                discount,
                discount_label: discountLabel,
                taxable: cartTotals.taxable,
                gst: cartTotals.tax,
                serviceCharge: cartTotals.service_charge,
                charges: cartTotals.charge_lines,
                taxLines: [...cartTotals.tax_lines, ...cartTotals.service_lines],
                total: cartTotals.grand_total
            });
        } catch (e) {
            alert(e.response?.data?.message || e.friendlyMessage || e.message || "Could not create the bill.");
        } finally {
            setBusy(false);
        }
    };

    const handlePaymentSuccess = (result) => {
        const number = billData?.order_number;
        const how = result?.printed === false ? "paid and sent to WhatsApp" : "paid and printed";
        pendingRef.current = null;
        setBillData(null);
        setCart([]);
        clearCustomer();
        setStylistId("");
        setDiscountValue("");
        setNotice(number ? `✓ Bill ${number} ${how}` : `✓ Bill ${how}`);
        loadTodayCount();
    };

    // No printer at this salon (Settings → Bills & WhatsApp): no Printer screen.
    const noPrinter = desk.bill_delivery === "no_printer";
    const views = noPrinter ? VIEWS.filter((v) => v.key !== "printer") : VIEWS;

    // ── WhatsApp ────────────────────────────────────────────────────
    // The number on the message is the shop number given when the salon was
    // created (restaurants.mobile).
    const shopForMessage = () => ({
        restaurant_name: salonInfo?.restaurant_name || currentUser?.restaurant_name,
        address: salonInfo?.address,
        mobile: desk.shop_mobile || salonInfo?.mobile
    });

    // What this till actually opens WhatsApp in: its own override, else the
    // salon-wide default (desk.whatsapp_via, set by the owner in Settings).
    const waVia = effectiveVia(waOverride, desk.whatsapp_via);

    // "" clears the override (follow the salon default); "web"/"app" set it.
    const updateWaOverride = (value) => {
        const v = value === "web" || value === "app" ? value : null;
        setWaOverride(v);
        setWhatsAppOverride(v);
    };

    const sendOnWhatsApp = (entry) => {
        const opened = openWhatsApp(whatsappUrl(entry.phone, entry.text, waVia), waVia);
        setWaBill({ ...entry, opened, blocked: !opened });
    };

    // BillModal hands over the bill as paid (picked charges, payment method)
    // on both "Send on WhatsApp" and "Print", and WhatsApp opens on the
    // customer's chat straight away.
    const handleSendWhatsApp = (paidOrder) => {
        const phone = whatsappNumber(paidOrder.customer_mobile);
        if (!phone) return;
        sendOnWhatsApp({
            number: paidOrder.order_number,
            customer: paidOrder.customer_name || paidOrder.customer_mobile,
            phone,
            text: buildBillMessage(billFromPrintedOrder(paidOrder), shopForMessage(), desk.whatsapp_template)
        });
    };

    // Bills → WhatsApp: send (or resend) a bill from earlier today.
    const sendSavedBillOnWhatsApp = async (bill) => {
        const phone = whatsappNumber(bill.customer_mobile);
        if (!phone) { alert("This bill has no customer mobile number."); return; }
        try {
            const [head, rows] = await Promise.all([getBill(bill.id), getOrderDetails(bill.id)]);
            const text = buildBillMessage(billFromSaved(head.data.data, rows.data.data || []), shopForMessage(), desk.whatsapp_template);
            if (!openWhatsApp(whatsappUrl(phone, text, waVia), waVia)) {
                alert("The browser blocked the WhatsApp window. Allow pop-ups for this page, then try again.");
            }
        } catch (e) {
            console.error("WhatsApp bill error:", e);
            alert("Could not load this bill.");
        }
    };

    // ── Bills screen ────────────────────────────────────────────────
    const refreshBillItems = async (orderId) => {
        try {
            const res = await getOrderDetails(orderId);
            setEditingBillItems(res.data.data || []);
        } catch (e) {
            console.error("Bill items error:", e);
            alert("Could not load this bill's services.");
        }
    };

    const openBillForEdit = async (bill) => {
        setEditingBill(bill);
        setEditingBillCharged(Number(bill.paid_amount || bill.grand_total || 0));
        setEditingBillItems([]);
        if (allItems.length === 0) loadAllItems();
        await refreshBillItems(bill.id);
    };

    const closeBillEdit = () => {
        setEditingBill(null);
        setEditingBillItems([]);
        setEditingBillCharged(0);
    };

    const withBillBusy = async (work, failure) => {
        setBillEditBusy(true);
        try {
            await work();
            await refreshBillItems(editingBill.id);
        } catch (e) {
            alert(e.response?.data?.message || e.friendlyMessage || failure);
        } finally {
            setBillEditBusy(false);
        }
    };

    const handleBillSetQty = (itemId, quantity) =>
        withBillBusy(() => setItemQuantity(itemId, quantity), "Could not change the quantity.");

    const handleBillRemove = async (rows) => {
        if (!window.confirm(`Remove ${rows[0]?.item_name || "this service"} from this bill?`)) return;
        await withBillBusy(async () => {
            for (const r of rows) await cancelItem(r.id);
        }, "Could not remove the service.");
    };

    const handleBillAdd = (menuItem) =>
        withBillBusy(() => addItemToOrder(editingBill.id, menuItem.id, 1), "Could not add the service.");

    // Save the corrected totals (bringing the recorded payment into line) and reprint.
    const handleBillReprint = async (method, totals) => {
        setBillEditBusy(true);
        try {
            const res = await rebillOrder(editingBill.id, method);
            const result = res.data.data;

            let header = editingBill;
            try {
                header = (await getBill(editingBill.id)).data.data;
            } catch (e) {
                console.error("Bill header reload failed, printing from screen:", e);
            }

            const opened = printCorrectedBill({
                title: header.restaurant_name || salonInfo?.restaurant_name || "InWallz",
                billNumber: header.order_number,
                place: [
                    header.customer_name || editingBill.customer_name,
                    (header.stylist_name || editingBill.stylist_name) && `Stylist: ${header.stylist_name || editingBill.stylist_name}`
                ].filter(Boolean).join(" · ") || "Walk-in",
                items: editingBillItems,
                subtotal: totals.subtotal,
                discount: totals.discount,
                discountLabel: totals.discountLabel,
                taxLines: totals.taxLines,
                charges: totals.charges,
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
            loadTodayCount();
        } catch (e) {
            console.error("Rebill error:", e);
            alert(e.response?.data?.message || e.friendlyMessage || "Could not save the corrected bill.");
        } finally {
            setBillEditBusy(false);
        }
    };

    const handleLogout = () => {
        authService.logout();
        window.location.href = "/";
    };

    const { date: currentDate, time: currentTime } = dateParts(now);

    // ── Render ──────────────────────────────────────────────────────
    return (
        <div className="cashier-app pos sl-pos">

            {/* Open/close the salon day (cash-up) + forgot-to-close pop-up. */}
            <DayControl />

            {sidebarOpen && <div className="pos-scrim" onClick={() => setSidebarOpen(false)} />}
            <aside className={`pos-drawer${sidebarOpen ? " open" : ""}`}>
                <div className="pos-drawer-head">
                    <span className="pos-drawer-logo">InWallz Salon</span>
                    <button className="pos-drawer-x" onClick={() => setSidebarOpen(false)} aria-label="Close menu">✕</button>
                </div>
                <nav className="pos-nav">
                    {views.map((v) => (
                        <button
                            key={v.key}
                            className={`pos-nav-item${activeView === v.key ? " active" : ""}`}
                            onClick={() => { setActiveView(v.key); setSidebarOpen(false); }}
                        >
                            {v.label}
                        </button>
                    ))}
                </nav>
            </aside>

            <header className="pos-topbar">
                <button className="pos-hamburger" onClick={() => setSidebarOpen((o) => !o)} title="Menu" aria-label="Menu">
                    <span /><span /><span />
                </button>
                <div className="pos-brand">
                    <span className="pos-logo">{salonInfo?.restaurant_name || currentUser?.restaurant_name || "InWallz Salon"}</span>
                    <span className="pos-open">● Front desk</span>
                </div>
                <div className="pos-stats">
                    <span className="pos-stat"><b>{todayBills}</b> Bills today</span>
                </div>
                <div className="pos-topactions">
                    <div className="pos-time">
                        <span className="pos-clock">{currentTime}</span>
                        <span className="pos-date">{currentDate}</span>
                    </div>
                    <div className="pos-user">
                        <div className="pos-avatar">{receptionistName.charAt(0)}</div>
                        <div className="pos-user-info">
                            <span className="pos-user-name">{receptionistName}</span>
                            <span className="pos-user-id">Receptionist</span>
                        </div>
                    </div>
                    <button className="pos-logout" onClick={handleLogout}>Logout</button>
                </div>
            </header>

            {activeView === "services" ? (
                <MenuAvailability title="✂ Service Availability" searchPlaceholder="Search service…" />
            ) : activeView === "bills" ? (
                <BillsHistory salon onOpenBill={openBillForEdit} onWhatsApp={sendSavedBillOnWhatsApp} />
            ) : activeView === "printer" && !noPrinter ? (
                <PrinterSetup salon />
            ) : (
                <div className="pos-body">

                    {/* SERVICES */}
                    <div className="pos-menu">
                        <div className="pos-menu-top">
                            <div className="pos-search">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                <input
                                    type="text"
                                    placeholder="Search services…"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <CategoryTabs
                            categories={categories}
                            selectedCategory={selectedCategory}
                            onSelectCategory={(id) => { setSearchTerm(""); setSelectedCategory(id); }}
                        />
                        <div className="pos-menu-grid">
                            {visibleItems.length === 0 ? (
                                <p className="pos-noitems">
                                    {categories.length === 0 ? "No services yet — the owner adds them in Services." : "No services found"}
                                </p>
                            ) : (
                                visibleItems.map((item) => (
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

                    {/* BILL */}
                    <aside className="pos-bill">
                        <div className="pos-bill-head">
                            <div className="pos-bill-headtext">
                                <span className="pos-bill-title">🧾 New Bill</span>
                                <span className="pos-bill-sub">
                                    {customer ? customer.customer_name : "Add the customer below"}
                                </span>
                            </div>
                            <div className="pos-bill-headbtns">
                                {(cart.length > 0 || mobile || customerName) && (
                                    <button className="pos-bill-clear" onClick={clearBill} title="Clear bill">✕</button>
                                )}
                            </div>
                        </div>

                        <div className="sl-cust">
                            <span className="sl-cust-label">Customer</span>
                            {customer ? (
                                <div className="sl-cust-found">
                                    <div>
                                        <div className="sl-cust-name">{customer.customer_name}</div>
                                        <div className="sl-cust-meta">
                                            {customer.mobile} · {customer.is_new ? "new customer" : "returning customer"}
                                        </div>
                                    </div>
                                    <button className="sl-cust-clear" onClick={clearCustomer}>Change</button>
                                </div>
                            ) : (
                                <>
                                    <div className="sl-cust-field">
                                        <input
                                            type="tel"
                                            role="combobox"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            placeholder="Mobile number *"
                                            value={mobile}
                                            onChange={(e) => onMobileChange(e.target.value)}
                                            onFocus={() => setSuggestFor("mobile")}
                                            onBlur={() => setSuggestFor(null)}
                                            onKeyDown={onSuggestKey}
                                            aria-label="Customer mobile number"
                                            aria-controls="sl-suggest-mobile"
                                            aria-autocomplete="list"
                                            aria-expanded={suggestFor === "mobile" && suggestions.length > 0}
                                        />
                                        {renderSuggestions("mobile")}
                                    </div>
                                    <div className="sl-cust-field">
                                        <input
                                            type="text"
                                            role="combobox"
                                            autoComplete="off"
                                            placeholder="Customer name *"
                                            value={customerName}
                                            onChange={(e) => onNameChange(e.target.value)}
                                            onFocus={() => setSuggestFor("name")}
                                            onBlur={() => setSuggestFor(null)}
                                            onKeyDown={onSuggestKey}
                                            maxLength={150}
                                            aria-label="Customer name"
                                            aria-controls="sl-suggest-name"
                                            aria-autocomplete="list"
                                            aria-expanded={suggestFor === "name" && suggestions.length > 0}
                                        />
                                        {renderSuggestions("name")}
                                    </div>
                                    {newNumber && newNumber === mobile ? (
                                        <span className="sl-cust-new">New customer — they'll be saved with this bill.</span>
                                    ) : (
                                        <span className="sl-cust-hint">Type a few digits or letters to find an existing customer.</span>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="sl-cust">
                            <span className="sl-cust-label">Stylist</span>
                            {stylists.length === 0 ? (
                                <span className="sl-cust-new">No stylists yet — the owner adds them in Employees.</span>
                            ) : (
                                <select
                                    className={stylistId ? "" : "sl-unset"}
                                    value={stylistId}
                                    onChange={(e) => setStylistId(e.target.value)}
                                    aria-label="Stylist"
                                >
                                    <option value="">Choose stylist *</option>
                                    {stylists.map((s) => (
                                        <option key={s.id} value={String(s.id)}>{s.full_name}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="pos-bill-scroll">
                            {cart.length === 0 ? (
                                <div className="pos-bill-empty">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>
                                    <p>Add services from the left</p>
                                </div>
                            ) : (
                                cart.map((item) => (
                                    <CartItem
                                        key={item.lineId}
                                        item={item}
                                        increaseQuantity={(lineId) => changeQuantity(lineId, 1)}
                                        decreaseQuantity={(lineId) => changeQuantity(lineId, -1)}
                                        removeItem={removeLine}
                                    />
                                ))
                            )}
                        </div>

                        <div className="pos-bill-foot">
                            <div className="pos-tot-row"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                            {/* Only when the owner allows discounts (Settings → Discounts). */}
                            {discountPolicy.enabled && cart.length > 0 && (percentAllowed || amountAllowed) && (
                                <div className="sl-discount">
                                    <span className="sl-discount-label">Discount</span>
                                    <div className="sl-discount-seg" role="group" aria-label="Discount type">
                                        {percentAllowed && (
                                            <button
                                                type="button"
                                                className={activeDiscountType === "percent" ? "active" : ""}
                                                aria-pressed={activeDiscountType === "percent"}
                                                onClick={() => setDiscountType("percent")}
                                            >%</button>
                                        )}
                                        {amountAllowed && (
                                            <button
                                                type="button"
                                                className={activeDiscountType === "amount" ? "active" : ""}
                                                aria-pressed={activeDiscountType === "amount"}
                                                onClick={() => setDiscountType("amount")}
                                            >₹</button>
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        inputMode="decimal"
                                        value={discountValue}
                                        onChange={(e) => setDiscountValue(e.target.value)}
                                        placeholder={activeDiscountType === "percent"
                                            ? `up to ${discountPolicy.max_percent}%`
                                            : `up to ₹${discountPolicy.max_amount}`}
                                        aria-label="Discount"
                                    />
                                </div>
                            )}
                            {discountProblem && <div className="sl-discount-error" role="alert">{discountProblem}</div>}
                            {discount > 0 && (
                                <div className="pos-tot-row sl-discount-row">
                                    <span>{discountLabel}</span><span>−₹{discount.toFixed(2)}</span>
                                </div>
                            )}
                            {lineCharges.map((c, i) => (
                                <div className="pos-tot-row" key={`${c.charge_name}-${i}`}>
                                    <span>{c.charge_name}</span><span>₹{c.amount.toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="pos-tot-row grand"><span>Total</span><span>₹{cartTotals.grand_total.toFixed(2)}</span></div>
                            <div className="pos-bill-actions">
                                <button className="pos-pay" onClick={handleBill} disabled={cart.length === 0 || busy || Boolean(discountProblem)}>
                                    {busy ? "Processing..." : "Bill & Take Payment →"}
                                </button>
                            </div>
                            {notice && <div className="sl-notice" role="status">{notice}</div>}

                            {waBill && (
                                <div className="sl-wa" role="status">
                                    <div className="sl-wa-head">
                                        <span className="sl-wa-title">
                                            {waBill.blocked
                                                ? "WhatsApp didn't open by itself"
                                                : `WhatsApp opened for ${waBill.customer}`}
                                        </span>
                                        <button type="button" className="sl-wa-close" onClick={() => setWaBill(null)} aria-label="Dismiss">✕</button>
                                    </div>
                                    <span className="sl-wa-hint">
                                        {waBill.blocked
                                            ? "Allow pop-ups for this page so it opens by itself next time."
                                            : waVia === "app"
                                                ? "Press Send in WhatsApp. Nothing opened? Install WhatsApp Desktop or switch to WhatsApp Web."
                                                : "The bill is typed in — press Send in WhatsApp."}
                                    </span>
                                    <button type="button" className="sl-wa-send" onClick={() => sendOnWhatsApp(waBill)}>
                                        {waBill.blocked ? "Send bill on WhatsApp" : "Open WhatsApp again"}
                                    </button>
                                    <div className="sl-wa-prefs">
                                        {showWaSwitch ? (
                                            <>
                                                <span>Open bills in</span>
                                                <select
                                                    value={waOverride || ""}
                                                    onChange={(e) => { updateWaOverride(e.target.value); setShowWaSwitch(false); }}
                                                    aria-label="Open bills in"
                                                    autoFocus
                                                >
                                                    <option value="">Salon default ({desk.whatsapp_via === "app" ? "app" : "Web"})</option>
                                                    <option value="web">WhatsApp Web</option>
                                                    <option value="app">WhatsApp app</option>
                                                </select>
                                            </>
                                        ) : (
                                            <button
                                                type="button"
                                                className="sl-wa-switch"
                                                onClick={() => setShowWaSwitch(true)}
                                            >
                                                Opens in {waVia === "app" ? "WhatsApp app" : "WhatsApp Web"}{waOverride ? "" : " (salon default)"} · Change
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </aside>

                </div>
            )}

            {billData && (
                <BillModal
                    order={billData}
                    restaurant={salonInfo}
                    format={salonBillFormat(billFormat)}
                    charges={charges}
                    onClose={() => setBillData(null)}
                    onSuccess={handlePaymentSuccess}
                    delivery={desk.bill_delivery}
                    onWhatsApp={handleSendWhatsApp}
                />
            )}

            {editingBill && (
                <BillEditModal
                    bill={editingBill}
                    items={editingBillItems}
                    menuItems={allItems}
                    busy={billEditBusy}
                    chargedTotal={editingBillCharged}
                    charges={charges}
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

export default SalonPos;
