import React, { useEffect, useState, useMemo, useRef } from "react";
import AdminLayout from "../../layouts/AdminLayout";
import billingFormatService from "../../services/billingFormatService";
import { DEFAULT_BILL_FORMAT, generateBillHtml, printBill } from "../../utils/billPrinter";
import "../../styles/pages/Admin/Billing.css";

const SAMPLE_ORDER = {
    order_number: "ORD-1024",
    tableName: "Table 5",
    table_number: "5",
    customer_name: "Rahul Sharma",
    waiter_name: "Ravi Kumar",
    cashier_name: "Anita",
    date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: "07:45 PM",
    payment_method: "UPI",
    items: [
        { item_name: "Paneer Butter Masala", quantity: 2, price: 240, notes: "Medium spicy" },
        { item_name: "Butter Naan", quantity: 4, price: 45 },
        { item_name: "Jeera Rice", quantity: 1, price: 160 },
        { item_name: "Fresh Lime Soda", quantity: 2, price: 60, notes: "Less ice" }
    ],
    subtotal: 860,
    gst: 43,
    service_charge: 17.20,
    charges: [
        { id: 1, charge_name: "Packaging / AC Charge", amount: 25, charge_type: "Fixed" }
    ],
    grand_total: 945.20
};

function Billing() {
    const fileInputRef = useRef(null);
    const [format, setFormat] = useState(DEFAULT_BILL_FORMAT);
    const [restaurant, setRestaurant] = useState({
        restaurant_name: "InWallz Restaurant",
        address: "123 Commercial Street, Indiranagar",
        city: "Bangalore",
        state: "Karnataka",
        pincode: "560038",
        mobile: "+91 98765 43210",
        email: "billing@inwallz.com",
        gst_number: "29AAAAA0000A1Z5",
        fssai_number: "11223344556677",
        logo: ""
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [alertMsg, setAlertMsg] = useState(null); // { type: 'success' | 'error', text: '' }

    useEffect(() => {
        loadBillingFormat();
    }, []);

    const loadBillingFormat = async () => {
        setLoading(true);
        try {
            const res = await billingFormatService.getBillingFormat();
            if (res.data?.success && res.data?.data) {
                const { format: savedFormat, restaurant: restInfo } = res.data.data;
                if (savedFormat) {
                    setFormat({ ...DEFAULT_BILL_FORMAT, ...savedFormat });
                }
                if (restInfo) {
                    setRestaurant((prev) => ({
                        ...prev,
                        ...restInfo,
                        restaurant_name: restInfo.restaurant_name || prev.restaurant_name,
                        address: restInfo.address || "",
                        city: restInfo.city || "",
                        state: restInfo.state || "",
                        pincode: restInfo.pincode || "",
                        mobile: restInfo.mobile || "",
                        email: restInfo.email || "",
                        gst_number: restInfo.gst_number || "",
                        fssai_number: restInfo.fssai_number || "",
                        logo: restInfo.logo || ""
                    }));
                }
            }
        } catch (err) {
            console.error("Failed to load billing format:", err);
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

    const handleRestaurantChange = (field, value) => {
        setRestaurant((prev) => ({
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

    // Logo Upload with Validation
    const handleLogoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation 1: File type
        const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp", "image/svg+xml"];
        if (!allowedTypes.includes(file.type)) {
            setAlertMsg({
                type: "error",
                text: "Invalid image format. Please upload a PNG, JPEG, WEBP, or SVG file."
            });
            e.target.value = "";
            return;
        }

        // Validation 2: File size max 2MB
        const maxBytes = 2 * 1024 * 1024;
        if (file.size > maxBytes) {
            setAlertMsg({
                type: "error",
                text: "Image file is too large. Maximum allowed size is 2MB."
            });
            e.target.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            setRestaurant((prev) => ({
                ...prev,
                logo: dataUrl
            }));
            // Automatically enable show_logo when a logo is uploaded
            setFormat((prev) => ({
                ...prev,
                show_logo: 1
            }));
            setAlertMsg({
                type: "success",
                text: "Logo loaded! Preview updated. Click 'Save Format' to apply changes permanently."
            });
        };
        reader.onerror = () => {
            setAlertMsg({ type: "error", text: "Failed to read image file." });
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveLogo = () => {
        setRestaurant((prev) => ({
            ...prev,
            logo: ""
        }));
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        setAlertMsg({
            type: "success",
            text: "Logo removed. Preview updated. Click 'Save Format' to apply changes."
        });
    };

    const handleResetDefaults = () => {
        if (window.confirm("Reset all settings to default print format?")) {
            setFormat({ ...DEFAULT_BILL_FORMAT });
            setAlertMsg({ type: "success", text: "Settings reset to defaults. Click 'Save Format' to apply." });
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setAlertMsg(null);
        try {
            const res = await billingFormatService.saveBillingFormat({
                format,
                restaurant
            });
            if (res.data?.success) {
                setAlertMsg({
                    type: "success",
                    text: "✓ Billing format and restaurant details saved successfully! All cashier & waiter prints will now use this format."
                });
            } else {
                setAlertMsg({ type: "error", text: res.data?.message || "Failed to save configuration." });
            }
        } catch (err) {
            console.error("Save billing format error:", err);
            setAlertMsg({ type: "error", text: err.response?.data?.message || "Error saving billing format." });
        } finally {
            setSaving(false);
        }
    };

    const handleTestPrint = () => {
        printBill({
            order: SAMPLE_ORDER,
            restaurant: restaurant,
            format: format
        });
    };

    // Live HTML generation for preview
    const previewHtml = useMemo(() => {
        return generateBillHtml({
            order: SAMPLE_ORDER,
            restaurant: restaurant,
            format: format
        });
    }, [format, restaurant]);

    return (
        <AdminLayout>
            <div className="billing-page">

                {/* Page Header */}
                <div className="page-header">
                    <div className="page-header-text">
                        <h2>Billing Format &amp; Print Customization</h2>
                        <p>Customize your printed receipts, branding, paper size, and visible fields.</p>
                    </div>
                    <div className="header-actions">
                        <button type="button" className="secondary-btn" onClick={handleResetDefaults} disabled={saving}>
                            Reset Defaults
                        </button>
                        <button type="button" className="primary-btn" onClick={handleSave} disabled={saving}>
                            {saving ? "Saving..." : "💾 Save Format"}
                        </button>
                    </div>
                </div>

                {/* Alert Notification */}
                {alertMsg && (
                    <div className={`billing-alert ${alertMsg.type}`}>
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
                        Loading billing settings…
                    </div>
                ) : (
                    <div className="billing-grid">

                        {/* Left Column: Customization Controls */}
                        <div className="settings-column">

                            {/* 1. Paper / Print Format */}
                            <div className="setting-card">
                                <div className="setting-card-header">
                                    <div className="setting-card-icon">📄</div>
                                    <h3 className="setting-card-title">1. Paper &amp; Receipt Size</h3>
                                </div>
                                <div className="paper-size-options">
                                    <div
                                        className={`paper-option ${format.paper_size === "thermal" ? "active" : ""}`}
                                        onClick={() => handlePaperChange("thermal")}
                                    >
                                        <div className="paper-option-icon">🧾</div>
                                        <div className="paper-option-title">80mm Thermal</div>
                                        <div className="paper-option-desc">Standard POS receipt (Default)</div>
                                    </div>
                                    <div
                                        className={`paper-option ${format.paper_size === "thermal-58" ? "active" : ""}`}
                                        onClick={() => handlePaperChange("thermal-58")}
                                    >
                                        <div className="paper-option-icon">🎫</div>
                                        <div className="paper-option-title">58mm Thermal</div>
                                        <div className="paper-option-desc">Compact handheld roll</div>
                                    </div>
                                    <div
                                        className={`paper-option ${format.paper_size === "a4" ? "active" : ""}`}
                                        onClick={() => handlePaperChange("a4")}
                                    >
                                        <div className="paper-option-icon">📑</div>
                                        <div className="paper-option-title">Standard A4</div>
                                        <div className="paper-option-desc">Full-page document invoice</div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Restaurant Header & Branding */}
                            <div className="setting-card">
                                <div className="setting-card-header">
                                    <div className="setting-card-icon">🏢</div>
                                    <h3 className="setting-card-title">2. Restaurant Header &amp; Branding</h3>
                                </div>

                                {/* Logo Management Block */}
                                <div className="logo-manager">
                                    <div className="logo-preview-box">
                                        {restaurant.logo ? (
                                            <img src={restaurant.logo} alt="Restaurant Logo" />
                                        ) : (
                                            <div className="no-logo">No Logo</div>
                                        )}
                                    </div>
                                    <div className="logo-controls">
                                        <div className="logo-actions">
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                                                style={{ display: "none" }}
                                                onChange={handleLogoUpload}
                                            />
                                            <button
                                                type="button"
                                                className="logo-upload-btn"
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                📷 {restaurant.logo ? "Change Logo" : "Upload Logo"}
                                            </button>

                                            {restaurant.logo && (
                                                <button
                                                    type="button"
                                                    className="danger-btn-outline"
                                                    onClick={handleRemoveLogo}
                                                >
                                                    🗑 Remove
                                                </button>
                                            )}

                                            <div className="field-toggle-inline" style={{ marginLeft: "auto" }}>
                                                <span>Show on Bill</span>
                                                <span className="switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(format.show_logo)}
                                                        onChange={() => handleToggle("show_logo")}
                                                    />
                                                    <span className="slider"></span>
                                                </span>
                                            </div>
                                        </div>
                                        <p className="logo-help-text">
                                            Recommended: PNG, JPG, or SVG with transparent background (Max 2MB).
                                        </p>
                                    </div>
                                </div>

                                {/* Header Tagline / Subtitle */}
                                <div className="input-group" style={{ marginBottom: "16px" }}>
                                    <label>Custom Header Subtitle / Tagline (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Tax Invoice / Fine Dining / Express Cafe"
                                        value={format.header_title || ""}
                                        onChange={(e) => handleTextChange("header_title", e.target.value)}
                                    />
                                </div>

                                {/* Editable Restaurant Details with Embedded Show/Hide Switches */}
                                <div className="restaurant-fields-list">

                                    {/* Restaurant Name */}
                                    <div className="field-row">
                                        <div className="field-header">
                                            <span className="field-label">Restaurant Name</span>
                                            <div className="field-toggle-inline">
                                                <span>Print on Bill</span>
                                                <span className="switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(format.show_restaurant_name)}
                                                        onChange={() => handleToggle("show_restaurant_name")}
                                                    />
                                                    <span className="slider"></span>
                                                </span>
                                            </div>
                                        </div>
                                        <input
                                            type="text"
                                            className="field-input"
                                            value={restaurant.restaurant_name || ""}
                                            onChange={(e) => handleRestaurantChange("restaurant_name", e.target.value)}
                                            placeholder="Enter Restaurant Name"
                                        />
                                    </div>

                                    {/* Address */}
                                    <div className="field-row">
                                        <div className="field-header">
                                            <span className="field-label">Address &amp; Location</span>
                                            <div className="field-toggle-inline">
                                                <span>Print on Bill</span>
                                                <span className="switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(format.show_address)}
                                                        onChange={() => handleToggle("show_address")}
                                                    />
                                                    <span className="slider"></span>
                                                </span>
                                            </div>
                                        </div>
                                        <input
                                            type="text"
                                            className="field-input"
                                            style={{ marginBottom: "8px" }}
                                            value={restaurant.address || ""}
                                            onChange={(e) => handleRestaurantChange("address", e.target.value)}
                                            placeholder="Street Address"
                                        />
                                        <div className="fields-inline-grid">
                                            <input
                                                type="text"
                                                className="field-input"
                                                value={restaurant.city || ""}
                                                onChange={(e) => handleRestaurantChange("city", e.target.value)}
                                                placeholder="City"
                                            />
                                            <input
                                                type="text"
                                                className="field-input"
                                                value={restaurant.state || ""}
                                                onChange={(e) => handleRestaurantChange("state", e.target.value)}
                                                placeholder="State"
                                            />
                                            <input
                                                type="text"
                                                className="field-input"
                                                value={restaurant.pincode || ""}
                                                onChange={(e) => handleRestaurantChange("pincode", e.target.value)}
                                                placeholder="PIN Code"
                                            />
                                        </div>
                                    </div>

                                    {/* Phone & Email */}
                                    <div className="fields-inline-grid">
                                        <div className="field-row">
                                            <div className="field-header">
                                                <span className="field-label">Phone (Mobile)</span>
                                                <span className="switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(format.show_phone)}
                                                        onChange={() => handleToggle("show_phone")}
                                                    />
                                                    <span className="slider"></span>
                                                </span>
                                            </div>
                                            <input
                                                type="text"
                                                className="field-input"
                                                value={restaurant.mobile || ""}
                                                onChange={(e) => handleRestaurantChange("mobile", e.target.value)}
                                                placeholder="+91 98765 43210"
                                            />
                                        </div>

                                        <div className="field-row">
                                            <div className="field-header">
                                                <span className="field-label">Email Address</span>
                                                <span className="switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(format.show_email)}
                                                        onChange={() => handleToggle("show_email")}
                                                    />
                                                    <span className="slider"></span>
                                                </span>
                                            </div>
                                            <input
                                                type="email"
                                                className="field-input"
                                                value={restaurant.email || ""}
                                                onChange={(e) => handleRestaurantChange("email", e.target.value)}
                                                placeholder="billing@restaurant.com"
                                            />
                                        </div>

                                        <div className="field-row">
                                            <div className="field-header">
                                                <span className="field-label">GSTIN</span>
                                                <span className="switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(format.show_gst)}
                                                        onChange={() => handleToggle("show_gst")}
                                                    />
                                                    <span className="slider"></span>
                                                </span>
                                            </div>
                                            <input
                                                type="text"
                                                className="field-input"
                                                value={restaurant.gst_number || ""}
                                                onChange={(e) => handleRestaurantChange("gst_number", e.target.value)}
                                                placeholder="29AAAAA0000A1Z5"
                                            />
                                        </div>
                                    </div>

                                    {/* FSSAI Number */}
                                    <div className="field-row">
                                        <div className="field-header">
                                            <span className="field-label">FSSAI License Number</span>
                                            <div className="field-toggle-inline">
                                                <span>Print on Bill</span>
                                                <span className="switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(format.show_fssai)}
                                                        onChange={() => handleToggle("show_fssai")}
                                                    />
                                                    <span className="slider"></span>
                                                </span>
                                            </div>
                                        </div>
                                        <input
                                            type="text"
                                            className="field-input"
                                            value={restaurant.fssai_number || ""}
                                            onChange={(e) => handleRestaurantChange("fssai_number", e.target.value)}
                                            placeholder="14-digit FSSAI Number (e.g. 11223344556677)"
                                        />
                                    </div>

                                </div>
                            </div>

                            {/* 3. Order Information & Staff */}
                            <div className="setting-card">
                                <div className="setting-card-header">
                                    <div className="setting-card-icon">📋</div>
                                    <h3 className="setting-card-title">3. Order Information &amp; Staff</h3>
                                </div>
                                <div className="toggle-grid">
                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Order / Bill #</span>
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
                                        <span className="toggle-label">Show Table Name</span>
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

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Waiter Name</span>
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
                                </div>
                            </div>

                            {/* 4. Item Line Columns */}
                            <div className="setting-card">
                                <div className="setting-card-header">
                                    <div className="setting-card-icon">🍽</div>
                                    <h3 className="setting-card-title">4. Item Line Columns</h3>
                                </div>
                                <div className="toggle-grid">
                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Quantity (Qty)</span>
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
                                        <span className="toggle-label">Show Unit Price / Rate</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_item_price)}
                                                onChange={() => handleToggle("show_item_price")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* 5. Summary, Taxes & Charges */}
                            <div className="setting-card">
                                <div className="setting-card-header">
                                    <div className="setting-card-icon">💰</div>
                                    <h3 className="setting-card-title">5. Summary, Taxes &amp; Charges</h3>
                                </div>
                                <div className="toggle-grid">
                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Subtotal</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_subtotal)}
                                                onChange={() => handleToggle("show_subtotal")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show GST / Tax</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_tax)}
                                                onChange={() => handleToggle("show_tax")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Service Charge</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_service_charge)}
                                                onChange={() => handleToggle("show_service_charge")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Additional Charges</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_charges)}
                                                onChange={() => handleToggle("show_charges")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>

                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Grand Total</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_grand_total)}
                                                onChange={() => handleToggle("show_grand_total")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* 6. Payment Details */}
                            <div className="setting-card">
                                <div className="setting-card-header">
                                    <div className="setting-card-icon">💳</div>
                                    <h3 className="setting-card-title">6. Payment Details</h3>
                                </div>
                                <div className="toggle-grid">
                                    <label className="toggle-item">
                                        <span className="toggle-label">Show Payment Mode (Cash/Card/UPI)</span>
                                        <span className="switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(format.show_payment_method)}
                                                onChange={() => handleToggle("show_payment_method")}
                                            />
                                            <span className="slider"></span>
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* 7. Footer & Terms */}
                            <div className="setting-card">
                                <div className="setting-card-header">
                                    <div className="setting-card-icon">📝</div>
                                    <h3 className="setting-card-title">7. Footer &amp; Terms</h3>
                                </div>
                                <div className="input-group">
                                    <label>Thank You Message / Footer Text</label>
                                    <input
                                        type="text"
                                        value={format.footer_text || ""}
                                        onChange={(e) => handleTextChange("footer_text", e.target.value)}
                                        placeholder="e.g. Thank you! Visit again."
                                    />
                                </div>
                                <div className="input-group" style={{ marginTop: "16px" }}>
                                    <label>Terms &amp; Conditions / Disclaimers (Optional)</label>
                                    <textarea
                                        rows={3}
                                        value={format.terms_text || ""}
                                        onChange={(e) => handleTextChange("terms_text", e.target.value)}
                                        placeholder="e.g. Goods once sold will not be returned. Computer generated invoice."
                                    />
                                </div>
                            </div>

                            {/* Bottom Save Action */}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
                                <button type="button" className="secondary-btn" onClick={handleResetDefaults} disabled={saving}>
                                    Reset Defaults
                                </button>
                                <button type="button" className="primary-btn" onClick={handleSave} disabled={saving}>
                                    {saving ? "Saving..." : "💾 Save Format"}
                                </button>
                            </div>

                        </div>

                        {/* Right Column: Live Real-Time Bill Preview */}
                        <div className="preview-column">
                            <div className="preview-card">
                                <div className="preview-header">
                                    <span className="preview-title">
                                        👁️ Live Print Preview
                                    </span>
                                    <span className="preview-badge">
                                        {format.paper_size === "a4" ? "A4 Sheet" : format.paper_size === "thermal-58" ? "58mm Roll" : "80mm Roll"}
                                    </span>
                                </div>
                                <div className="preview-body">
                                    <div
                                        className="preview-paper"
                                        style={{
                                            maxWidth: format.paper_size === "a4" ? "100%" : format.paper_size === "thermal-58" ? "250px" : "340px"
                                        }}
                                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                                    />
                                </div>
                                <div className="preview-footer">
                                    <span className="preview-note">Preview updates automatically with every change.</span>
                                    <button type="button" className="primary-btn" onClick={handleTestPrint} style={{ padding: "8px 16px", fontSize: "13px" }}>
                                        🖨 Test Print
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

export default Billing;
