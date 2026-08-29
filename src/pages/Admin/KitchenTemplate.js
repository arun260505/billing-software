import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "../../layouts/AdminLayout";
import kitchenFormatService from "../../services/kitchenFormatService";
import { DEFAULT_KITCHEN_FORMAT, generateKitchenTicketHtml, printKitchenTicket } from "../../utils/kitchenPrinter";
import "../../styles/pages/Admin/KitchenTemplate.css";

const SAMPLE_DINE_IN_ORDER = {
    order_number: "ORD-1024",
    order_type: "Dine-In",
    tableName: "Table 5",
    table_number: "5",
    customer_name: "Rahul Sharma",
    waiter_name: "Ravi Kumar",
    cashier_name: "Anita",
    date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: "07:45 PM",
    items: [
        { item_name: "Paneer Butter Masala", quantity: 2, notes: "Medium spicy", category_name: "Main Course" },
        { item_name: "Butter Naan", quantity: 4, notes: "Crispy", category_name: "Breads" },
        { item_name: "Jeera Rice", quantity: 1, category_name: "Rice" },
        { item_name: "Fresh Lime Soda", quantity: 2, notes: "Less ice, sweet & salt", category_name: "Beverages" }
    ]
};

const SAMPLE_PARCEL_ORDER = {
    order_number: "ORD-1025",
    order_type: "Takeaway",
    isParcel: true,
    tableName: "Counter",
    customer_name: "Vikram Singh",
    waiter_name: "Ravi Kumar",
    cashier_name: "Anita",
    date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: "07:50 PM",
    items: [
        { item_name: "Chicken Biryani", quantity: 2, notes: "Extra raita and salan", category_name: "Biryani" },
        { item_name: "Tandoori Roti", quantity: 6, notes: "Hot pack", category_name: "Breads" },
        { item_name: "Gulab Jamun", quantity: 4, category_name: "Desserts" }
    ]
};

function KitchenTemplate() {
    const [format, setFormat] = useState(DEFAULT_KITCHEN_FORMAT);
    const [restaurant, setRestaurant] = useState({
        restaurant_name: "InWallz Restaurant",
        address: "123 Commercial Street, Indiranagar",
        city: "Bangalore",
        mobile: "+91 98765 43210",
        logo: ""
    });

    const [previewMode, setPreviewMode] = useState("dine-in"); // "dine-in" | "parcel"
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [alertMsg, setAlertMsg] = useState(null);

    useEffect(() => {
        loadKitchenFormat();
    }, []);

    const loadKitchenFormat = async () => {
        setLoading(true);
        try {
            const res = await kitchenFormatService.getKitchenFormat();
            if (res.data?.success && res.data?.data) {
                const { format: savedFormat, restaurant: restInfo } = res.data.data;
                if (savedFormat) {
                    setFormat({ ...DEFAULT_KITCHEN_FORMAT, ...savedFormat });
                }
                if (restInfo) {
                    setRestaurant((prev) => ({
                        ...prev,
                        ...restInfo,
                        restaurant_name: restInfo.restaurant_name || prev.restaurant_name,
                        address: restInfo.address || "",
                        city: restInfo.city || "",
                        mobile: restInfo.mobile || "",
                        logo: restInfo.logo || ""
                    }));
                }
            }
        } catch (err) {
            console.error("Failed to load kitchen format:", err);
            setAlertMsg({ type: "error", text: "Could not load saved configuration. Default settings applied." });
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (field) => {
        setFormat((prev) => ({
            ...prev,
            [field]: prev[field] ? 0 : 1
        }));
    };

    const handleTextChange = (field, value) => {
        setFormat((prev) => ({
            ...prev,
            [field]: value
        }));
    };

    const handlePaperChange = (paperSize) => {
        setFormat((prev) => ({
            ...prev,
            paper_size: paperSize
        }));
    };

    const handleResetDefaults = () => {
        if (window.confirm("Reset all kitchen template settings to defaults?")) {
            setFormat({ ...DEFAULT_KITCHEN_FORMAT });
            setAlertMsg({ type: "success", text: "Settings reset to defaults. Click 'Save Template' to apply permanently." });
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setAlertMsg(null);
        try {
            const res = await kitchenFormatService.saveKitchenFormat(format);
            if (res.data?.success) {
                setAlertMsg({
                    type: "success",
                    text: "✓ Kitchen Order Ticket (KOT) template saved successfully! All cashier & waiter kitchen prints will now use this format."
                });
            } else {
                setAlertMsg({ type: "error", text: res.data?.message || "Failed to save configuration." });
            }
        } catch (err) {
            console.error("Save kitchen format error:", err);
            setAlertMsg({ type: "error", text: err.response?.data?.message || "Error saving kitchen template." });
        } finally {
            setSaving(false);
        }
    };

    const activeSampleOrder = previewMode === "parcel" ? SAMPLE_PARCEL_ORDER : SAMPLE_DINE_IN_ORDER;

    const handleTestPrint = () => {
        printKitchenTicket({
            order: activeSampleOrder,
            restaurant: restaurant,
            format: format
        });
    };

    const previewHtml = useMemo(() => {
        return generateKitchenTicketHtml({
            order: activeSampleOrder,
            restaurant: restaurant,
            format: format
        });
    }, [format, restaurant, activeSampleOrder]);

    return (
        <AdminLayout>
            <div className="kitchen-template-page">

                {/* Page Header */}
                <div className="page-header">
                    <div className="page-header-text">
                        <h2>Kitchen Template &amp; KOT Print Customization</h2>
                        <p>Customize thermal Kitchen Order Tickets (KOT) sent to the kitchen printer.</p>
                    </div>
                    <div className="header-actions">
                        <button type="button" className="secondary-btn" onClick={handleResetDefaults} disabled={saving}>
                            Reset Defaults
                        </button>
                        <button type="button" className="primary-btn" onClick={handleSave} disabled={saving}>
                            {saving ? "Saving..." : "💾 Save Template"}
                        </button>
                    </div>
                </div>

                {/* Alert Notification */}
                {alertMsg && (
                    <div className={`kitchen-alert ${alertMsg.type}`}>
                        <span>{alertMsg.text}</span>
                        <button
                            type="button"
                            onClick={() => setAlertMsg(null)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "inherit" }}
                        >
                            ✕
                        </button>
                    </div>
                )}

                {loading ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                        Loading kitchen template settings…
                    </div>
                ) : (
                    <div className="kitchen-grid">

                        {/* Left Column: Customization Controls */}
                        <div className="settings-column">

                            {/* 1. Paper / Print Format */}
                            <div className="setting-card">
                                <div className="setting-card-header">
                                    <div className="setting-card-icon">🖨</div>
                                    <h3 className="setting-card-title">1. Kitchen Paper &amp; Roll Size</h3>
                                </div>
                                <div className="paper-size-options">
                                    <div
                                        className={`paper-option ${format.paper_size === "thermal" ? "active" : ""}`}
                                        onClick={() => handlePaperChange("thermal")}
                                    >
                                        <div className="paper-option-icon">🧾</div>
                                        <div className="paper-option-title">80mm Thermal</div>
                                        <div className="paper-option-desc">Standard Kitchen Roll (Default)</div>
                                    </div>
                                    <div
                                        className={`paper-option ${format.paper_size === "thermal-58" ? "active" : ""}`}
                                        onClick={() => handlePaperChange("thermal-58")}
                                    >
                                        <div className="paper-option-icon">🎫</div>
                                        <div className="paper-option-title">58mm Thermal</div>
                                        <div className="paper-option-desc">Compact Kitchen Roll</div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Header & Restaurant Information */}
                            <div className="setting-card">
                                <div className="setting-card-header">
                                    <div className="setting-card-icon">🏢</div>
                                    <h3 className="setting-card-title">2. Header &amp; Order Information</h3>
                                </div>

                                <div className="input-group" style={{ marginBottom: "16px" }}>
                                    <label>Header Title / Tagline</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. KITCHEN ORDER TICKET / KOT"
                                        value={format.header_title || ""}
                                        onChange={(e) => handleTextChange("header_title", e.target.value)}
                                    />
                                </div>

                                <div className="toggle-grid">
                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Restaurant Logo</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_logo)}
                                                onChange={() => handleToggle("show_logo")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Restaurant Name</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_restaurant_name)}
                                                onChange={() => handleToggle("show_restaurant_name")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Address</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_address)}
                                                onChange={() => handleToggle("show_address")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Phone Number</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_phone)}
                                                onChange={() => handleToggle("show_phone")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Order / KOT Number</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_order_number)}
                                                onChange={() => handleToggle("show_order_number")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Order Type (Dine-in / Parcel)</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_order_type)}
                                                onChange={() => handleToggle("show_order_type")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Table Name / Number</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_table_name)}
                                                onChange={() => handleToggle("show_table_name")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Date</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_date)}
                                                onChange={() => handleToggle("show_date")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Time</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_time)}
                                                onChange={() => handleToggle("show_time")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Waiter / Server Name</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_waiter_name)}
                                                onChange={() => handleToggle("show_waiter_name")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Cashier Name</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_cashier_name)}
                                                onChange={() => handleToggle("show_cashier_name")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Customer Name</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_customer_name)}
                                                onChange={() => handleToggle("show_customer_name")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* 3. Kitchen Item Details */}
                            <div className="setting-card">
                                <div className="setting-card-header">
                                    <div className="setting-card-icon">🍳</div>
                                    <h3 className="setting-card-title">3. Kitchen Item Details</h3>
                                </div>
                                <div className="toggle-grid">
                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Quantity (QTY)</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_item_qty)}
                                                onChange={() => handleToggle("show_item_qty")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Item Name</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_item_name)}
                                                onChange={() => handleToggle("show_item_name")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Item Cooking Notes / Special Instructions</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_item_notes)}
                                                onChange={() => handleToggle("show_item_notes")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Item Category</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_item_category)}
                                                onChange={() => handleToggle("show_item_category")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* 4. Kitchen Footer */}
                            <div className="setting-card">
                                <div className="setting-card-header">
                                    <div className="setting-card-icon">📝</div>
                                    <h3 className="setting-card-title">4. Kitchen Footer Message</h3>
                                </div>
                                <div className="input-group">
                                    <label>Kitchen Instruction / Footer Text</label>
                                    <input
                                        type="text"
                                        value={format.footer_text || ""}
                                        onChange={(e) => handleTextChange("footer_text", e.target.value)}
                                        placeholder="e.g. Please prepare carefully."
                                    />
                                </div>
                            </div>

                            {/* Bottom Actions */}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
                                <button type="button" className="secondary-btn" onClick={handleResetDefaults} disabled={saving}>
                                    Reset Defaults
                                </button>
                                <button type="button" className="primary-btn" onClick={handleSave} disabled={saving}>
                                    {saving ? "Saving..." : "💾 Save Template"}
                                </button>
                            </div>

                        </div>

                        {/* Right Column: Live Real-Time KOT Preview */}
                        <div className="preview-column">
                            <div className="preview-card">
                                <div className="preview-header">
                                    <span className="preview-title">
                                        👁️ Live KOT Print Preview
                                    </span>
                                    <span className="preview-badge">
                                        {format.paper_size === "thermal-58" ? "58mm Roll" : "80mm Roll"}
                                    </span>
                                </div>
                                <div className="preview-body">
                                    {/* Preview Order Mode Selector */}
                                    <div className="preview-mode-toggle">
                                        <button
                                            type="button"
                                            className={`preview-mode-btn ${previewMode === "dine-in" ? "active" : ""}`}
                                            onClick={() => setPreviewMode("dine-in")}
                                        >
                                            🍽️ Dine-In Order
                                        </button>
                                        <button
                                            type="button"
                                            className={`preview-mode-btn ${previewMode === "parcel" ? "active" : ""}`}
                                            onClick={() => setPreviewMode("parcel")}
                                        >
                                            📦 Parcel / Takeaway
                                        </button>
                                    </div>

                                    <div
                                        className="preview-paper"
                                        style={{
                                            maxWidth: format.paper_size === "thermal-58" ? "250px" : "340px"
                                        }}
                                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                                    />
                                </div>
                                <div className="preview-footer">
                                    <span className="preview-note">Live preview updates immediately.</span>
                                    <button type="button" className="primary-btn" onClick={handleTestPrint} style={{ padding: "8px 16px", fontSize: "13px" }}>
                                        🖨 Test Print KOT
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

            </div>
        </AdminLayout>
    );
}

export default KitchenTemplate;
