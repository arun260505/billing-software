import React, { useEffect, useState, useCallback, useRef } from "react";
import AdminLayout from "../../layouts/AdminLayout";
import printerSettingService from "../../services/printerSettingService";
import settingsService from "../../services/settingsService";
import {
    PRINTER_MODE_OPTIONS,
    DEFAULT_PRINTER_MODE,
    normalizePrinterMode
} from "../../utils/printerMode";
import { isSalon } from "../../utils/businessType";
import {
    BILL_DELIVERY,
    DEFAULT_WHATSAPP_TEMPLATE,
    WHATSAPP_TAGS,
    WHATSAPP_TEMPLATE_MAX,
    SAMPLE_BILL,
    buildBillMessage,
    normalizeBillDelivery
} from "../../utils/whatsappBill";

import "../../styles/pages/Admin/Settings.css";

const TABS = [
    { key: "restaurant", label: "Restaurant" },
    { key: "payments", label: "Payments" },
    { key: "staff", label: "Staff & Permissions" },
    { key: "security", label: "Security" },
    { key: "printers", label: "Printers & Kitchen" },
    { key: "order-number-format", label: "Order Number Format" }
];

const CURRENCIES = [
    { code: "INR", symbol: "\u20B9", label: "\u20B9 INR" },
    { code: "USD", symbol: "$", label: "$ USD" },
    { code: "EUR", symbol: "\u20AC", label: "\u20AC EUR" },
    { code: "GBP", symbol: "\u00A3", label: "\u00A3 GBP" },
    { code: "AED", symbol: "AED", label: "AED" },
    { code: "SAR", symbol: "SAR", label: "SAR" }
];

const TIMEZONES = [
    "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Shanghai",
    "Asia/Tokyo", "Europe/London", "Europe/Berlin", "America/New_York",
    "America/Los_Angeles", "Australia/Sydney"
];

const TIME_SLOTS = [];
for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
        const hh = String(h).padStart(2, "0");
        const mm = String(m).padStart(2, "0");
        TIME_SLOTS.push(`${hh}:${mm}`);
    }
}

// ═══════════════════════════════════════════════════════════════
// Tab: Restaurant
// ═══════════════════════════════════════════════════════════════

function TabRestaurant() {
    const [data, setData] = useState(null);
    const [saved, setSaved] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        settingsService.getRestaurant().then((res) => {
            const d = res.data?.data || {};
            setData(d);
            setSaved(d);
        }).catch((err) => {
            setError(err.response?.data?.message || `Failed to load ${isSalon() ? "salon" : "restaurant"} settings.`);
        }).finally(() => setLoading(false));
    }, []);

    const update = (key, value) => {
        setData((prev) => ({ ...prev, [key]: value }));
        setNotice("");
    };

    const dirty = JSON.stringify(data) !== JSON.stringify(saved);

    const handleSave = async () => {
        setSaving(true);
        setNotice("");
        try {
            const res = await settingsService.saveRestaurant(data);
            setSaved(res.data?.data);
            setData(res.data?.data);
            setNotice("Restaurant settings saved.");
        } catch (err) {
            setError(err.response?.data?.message || `Could not save ${isSalon() ? "salon" : "restaurant"} settings.`);
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setError("Logo must be under 5 MB."); return; }
        const reader = new FileReader();
        reader.onload = () => { update("logo", reader.result); setNotice(""); };
        reader.readAsDataURL(file);
    };

    if (loading) return <div className="set-loading">Loading {isSalon() ? "salon" : "restaurant"} settings...</div>;

    return (
        <>
            {error && <div className="set-alert set-alert-warn">{error}</div>}
            {notice && <div className="set-alert set-alert-ok">{notice}</div>}

            <div className="set-grid">
                <div className="set-field">
                    <label>{isSalon() ? "Salon Name" : "Restaurant Name"}</label>
                    <input type="text" value={data?.restaurant_name || ""} onChange={(e) => update("restaurant_name", e.target.value)} placeholder={isSalon() ? "Salon name" : "Restaurant name"} />
                </div>
                <div className="set-field">
                    <label>Phone</label>
                    <input type="text" value={data?.phone || ""} onChange={(e) => update("phone", e.target.value)} placeholder="Phone number" />
                </div>
                <div className="set-field">
                    <label>Email</label>
                    <input type="email" value={data?.email || ""} onChange={(e) => update("email", e.target.value)} placeholder="Email address" />
                </div>
                <div className="set-field">
                    <label>GST / Tax Number</label>
                    <input type="text" value={data?.gst_number || ""} onChange={(e) => update("gst_number", e.target.value)} placeholder="GST number" />
                </div>
                <div className="set-field set-field-full">
                    <label>Address</label>
                    <textarea value={data?.address || ""} onChange={(e) => update("address", e.target.value)} placeholder={isSalon() ? "Salon address" : "Restaurant address"} rows={2} />
                </div>
                <div className="set-field">
                    <label>Currency</label>
                    <select value={data?.currency || "INR"} onChange={(e) => {
                        const c = CURRENCIES.find((x) => x.code === e.target.value);
                        update("currency", e.target.value);
                        if (c) update("currency_symbol", c.symbol);
                    }}>
                        {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                </div>
                <div className="set-field">
                    <label>Time Zone</label>
                    <select value={data?.time_zone || "Asia/Kolkata"} onChange={(e) => update("time_zone", e.target.value)}>
                        {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                </div>
                <div className="set-field">
                    <label>Opening Time</label>
                    <select value={data?.opening_time || ""} onChange={(e) => update("opening_time", e.target.value || null)}>
                        <option value="">Not set</option>
                        {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="set-field">
                    <label>Closing Time</label>
                    <select value={data?.closing_time || ""} onChange={(e) => update("closing_time", e.target.value || null)}>
                        <option value="">Not set</option>
                        {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="set-field">
                    <label>{isSalon() ? "Salon Status" : "Restaurant Status"}</label>
                    <div className="set-toggle-group">
                        <button type="button" className={`set-toggle-btn${data?.restaurant_status === "Open" ? " active" : ""}`} onClick={() => update("restaurant_status", "Open")}>Open</button>
                        <button type="button" className={`set-toggle-btn${data?.restaurant_status === "Closed" ? " active" : ""}`} onClick={() => update("restaurant_status", "Closed")}>Closed</button>
                    </div>
                </div>
                <div className="set-field">
                    <label>Invoice Footer</label>
                    <input type="text" value={data?.invoice_footer || ""} onChange={(e) => update("invoice_footer", e.target.value)} placeholder="Thank you! Visit again." />
                </div>
            </div>

            <div className="set-field">
                <label>Logo</label>
                <div className="set-logo-row">
                    {data?.logo && <img src={data.logo} alt="Logo" className="set-logo-preview" />}
                    <label className="set-upload-btn">
                        {data?.logo ? "Change Logo" : "Upload Logo"}
                        <input type="file" accept="image/*" onChange={handleLogoUpload} hidden />
                    </label>
                    {data?.logo && <button type="button" className="set-remove-btn" onClick={() => update("logo", null)}>Remove</button>}
                </div>
            </div>

            <div className="set-section-footer">
                <button className="set-save-btn" onClick={handleSave} disabled={saving || !dirty}>
                    {saving ? "Saving..." : dirty ? "Save Changes" : "Saved"}
                </button>
            </div>
        </>
    );
}

// ═══════════════════════════════════════════════════════════════
// Tab: Payments
// ═══════════════════════════════════════════════════════════════

function TabPayments() {
    const [data, setData] = useState(null);
    const [saved, setSaved] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        settingsService.getPayments().then((res) => {
            const d = res.data?.data || {};
            setData(d);
            setSaved(d);
        }).catch((err) => {
            setError(err.response?.data?.message || "Failed to load payment settings.");
        }).finally(() => setLoading(false));
    }, []);

    const toggle = (key) => {
        setData((prev) => ({ ...prev, [key]: prev[key] ? 0 : 1 }));
        setNotice("");
    };

    const dirty = JSON.stringify(data) !== JSON.stringify(saved);

    const handleSave = async () => {
        setSaving(true);
        setNotice("");
        try {
            const res = await settingsService.savePayments(data);
            setSaved(res.data?.data);
            setData(res.data?.data);
            setNotice("Payment settings saved.");
        } catch (err) {
            setError(err.response?.data?.message || "Could not save payment settings.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="set-loading">Loading payment settings...</div>;

    const methods = [
        { key: "cash_enabled", label: "Cash", desc: "Accept cash payments at the counter." },
        { key: "upi_enabled", label: "GPay / UPI", desc: "Accept UPI payments via QR code or collect ID." },
        { key: "card_enabled", label: "Card", desc: "Accept credit/debit card payments." },
        { key: "other_enabled", label: "Other", desc: "Accept cheque, gift card, or other methods." }
    ];

    return (
        <>
            {error && <div className="set-alert set-alert-warn">{error}</div>}
            {notice && <div className="set-alert set-alert-ok">{notice}</div>}

            <div className="set-payment-methods">
                {methods.map((m) => (
                    <div key={m.key} className="set-payment-row">
                        <div className="set-payment-info">
                            <strong>{m.label}</strong>
                            <span>{m.desc}</span>
                        </div>
                        <button type="button" className={`set-switch${data?.[m.key] ? " on" : ""}`} onClick={() => toggle(m.key)} disabled={saving}>
                            <span className="set-switch-track"><span className="set-switch-thumb" /></span>
                        </button>
                    </div>
                ))}
            </div>

            {data?.upi_enabled ? (
                <div className="set-field" style={{ marginTop: 16 }}>
                    <label>UPI ID</label>
                    <input type="text" value={data?.upi_id || ""} onChange={(e) => { setData((p) => ({ ...p, upi_id: e.target.value })); setNotice(""); }} placeholder="yourname@upi" />
                </div>
            ) : null}

            <div className="set-section-footer">
                <button className="set-save-btn" onClick={handleSave} disabled={saving || !dirty}>
                    {saving ? "Saving..." : dirty ? "Save Changes" : "Saved"}
                </button>
            </div>
        </>
    );
}

// ═══════════════════════════════════════════════════════════════
// Tab: Staff & Permissions
// ═══════════════════════════════════════════════════════════════

function TabStaffPermissions() {
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [selectedRole, setSelectedRole] = useState(null);
    const [rolePerms, setRolePerms] = useState([]);
    const [savedPerms, setSavedPerms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        Promise.all([settingsService.getRoles(), settingsService.getPermissions()])
            .then(([rolesRes, permsRes]) => {
                setRoles(rolesRes.data?.data || []);
                setPermissions(permsRes.data?.data || []);
            })
            .catch((err) => setError(err.response?.data?.message || "Failed to load staff data."))
            .finally(() => setLoading(false));
    }, []);

    const loadRolePerms = useCallback(async (roleId) => {
        if (!roleId) return;
        try {
            const res = await settingsService.getRolePermissions(roleId);
            const ids = res.data?.data?.permission_ids || [];
            setRolePerms(ids);
            setSavedPerms(ids);
            setError("");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load permissions.");
        }
    }, []);

    useEffect(() => {
        if (selectedRole) loadRolePerms(selectedRole);
    }, [selectedRole, loadRolePerms]);

    const togglePerm = (permId) => {
        setRolePerms((prev) => prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]);
        setNotice("");
    };

    const dirty = JSON.stringify(rolePerms) !== JSON.stringify(savedPerms);

    const handleSave = async () => {
        if (!selectedRole) return;
        setSaving(true);
        try {
            await settingsService.saveRolePermissions(selectedRole, rolePerms);
            setSavedPerms(rolePerms);
            setNotice("Permissions saved.");
        } catch (err) {
            setError(err.response?.data?.message || "Could not save permissions.");
        } finally {
            setSaving(false);
        }
    };

    const grouped = {};
    permissions.forEach((p) => {
        const mod = p.module_name || "General";
        if (!grouped[mod]) grouped[mod] = [];
        grouped[mod].push(p);
    });

    if (loading) return <div className="set-loading">Loading staff & permissions...</div>;

    return (
        <>
            {error && <div className="set-alert set-alert-warn">{error}</div>}
            {notice && <div className="set-alert set-alert-ok">{notice}</div>}

            <div className="set-staff-layout">
                <div className="set-role-list">
                    <h4>Roles</h4>
                    {roles.map((r) => (
                        <button key={r.id} type="button" className={`set-role-chip${selectedRole === r.id ? " active" : ""}`} onClick={() => { setSelectedRole(r.id); setNotice(""); }}>
                            {r.role_name}
                        </button>
                    ))}
                    {roles.length === 0 && <p className="set-empty-text">No roles found.</p>}
                </div>

                <div className="set-perm-grid">
                    {!selectedRole ? (
                        <p className="set-empty-text">Select a role to manage its permissions.</p>
                    ) : (
                        Object.entries(grouped).map(([module, perms]) => (
                            <div key={module} className="set-perm-module">
                                <h5>{module}</h5>
                                {perms.map((p) => (
                                    <label key={p.id} className="set-perm-check">
                                        <input type="checkbox" checked={rolePerms.includes(p.id)} onChange={() => togglePerm(p.id)} disabled={saving} />
                                        <span>{p.permission_name}</span>
                                    </label>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {selectedRole && (
                <div className="set-section-footer">
                    <button className="set-save-btn" onClick={handleSave} disabled={saving || !dirty}>
                        {saving ? "Saving..." : dirty ? "Save Permissions" : "Saved"}
                    </button>
                </div>
            )}
        </>
    );
}

// ═══════════════════════════════════════════════════════════════
// Tab: Security
// ═══════════════════════════════════════════════════════════════

function TabSecurity() {
    const [sec, setSec] = useState(null);
    const [savedSec, setSavedSec] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");

    const [pw, setPw] = useState({ current_password: "", new_password: "", confirm_password: "" });
    const [pwSaving, setPwSaving] = useState(false);
    const [pwNotice, setPwNotice] = useState("");
    const [pwError, setPwError] = useState("");

    useEffect(() => {
        settingsService.getSecurity().then((res) => {
            const d = res.data?.data || {};
            setSec(d);
            setSavedSec(d);
        }).catch((err) => {
            setError(err.response?.data?.message || "Failed to load security settings.");
        }).finally(() => setLoading(false));
    }, []);

    const toggle = (key) => {
        setSec((prev) => ({ ...prev, [key]: prev[key] ? 0 : 1 }));
        setNotice("");
    };

    const dirty = JSON.stringify(sec) !== JSON.stringify(savedSec);

    const handleSave = async () => {
        setSaving(true);
        setNotice("");
        try {
            const res = await settingsService.saveSecurity(sec);
            setSavedSec(res.data?.data);
            setSec(res.data?.data);
            setNotice("Security settings saved.");
        } catch (err) {
            setError(err.response?.data?.message || "Could not save security settings.");
        } finally {
            setSaving(false);
        }
    };

    const handlePassword = async () => {
        setPwError("");
        setPwNotice("");
        if (!pw.current_password || !pw.new_password) { setPwError("Both current and new password are required."); return; }
        if (pw.new_password.length < 6) { setPwError("New password must be at least 6 characters."); return; }
        if (pw.new_password !== pw.confirm_password) { setPwError("Passwords do not match."); return; }
        setPwSaving(true);
        try {
            await settingsService.changePassword(pw);
            setPwNotice("Password changed successfully.");
            setPw({ current_password: "", new_password: "", confirm_password: "" });
        } catch (err) {
            setPwError(err.response?.data?.message || "Could not change password.");
        } finally {
            setPwSaving(false);
        }
    };

    if (loading) return <div className="set-loading">Loading security settings...</div>;

    const approvals = [
        // A salon controls discounts in its own Discounts tab instead.
        ...(isSalon() ? [] : [{ key: "discount_approval", label: "Discounts", desc: "Require admin approval before applying discounts." }]),
        { key: "refund_approval", label: "Refunds", desc: "Require admin approval before processing refunds." },
        isSalon()
            ? { key: "cancel_order_approval", label: "Cancel Bills", desc: "Require the owner's approval before a receptionist cancels a bill." }
            : { key: "cancel_order_approval", label: "Cancel Completed Orders", desc: "Require admin approval before cancelling orders." },
        { key: "menu_price_change_approval", label: "Menu Price Changes", desc: "Require admin approval before changing menu prices." }
    ];

    return (
        <>
            {error && <div className="set-alert set-alert-warn">{error}</div>}
            {notice && <div className="set-alert set-alert-ok">{notice}</div>}

            <div className="set-section-inner">
                <h4>Session Timeout</h4>
                <div className="set-field" style={{ maxWidth: 220 }}>
                    <label>Timeout Duration</label>
                    <select value={sec?.session_timeout_hours || 8} onChange={(e) => { setSec((p) => ({ ...p, session_timeout_hours: Number(e.target.value) })); setNotice(""); }}>
                        {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                            <option key={h} value={h}>{h} {h === 1 ? "Hour" : "Hours"}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="set-section-inner">
                <h4>Require Admin Approval For</h4>
                <div className="set-payment-methods">
                    {approvals.map((a) => (
                        <div key={a.key} className="set-payment-row">
                            <div className="set-payment-info">
                                <strong>{a.label}</strong>
                                <span>{a.desc}</span>
                            </div>
                            <button type="button" className={`set-switch${sec?.[a.key] ? " on" : ""}`} onClick={() => toggle(a.key)} disabled={saving}>
                                <span className="set-switch-track"><span className="set-switch-thumb" /></span>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="set-section-footer">
                <button className="set-save-btn" onClick={handleSave} disabled={saving || !dirty}>
                    {saving ? "Saving..." : dirty ? "Save Changes" : "Saved"}
                </button>
            </div>

            <div className="set-section-inner" style={{ marginTop: 24 }}>
                <h4>Change Admin Password</h4>
                {pwError && <div className="set-alert set-alert-warn">{pwError}</div>}
                {pwNotice && <div className="set-alert set-alert-ok">{pwNotice}</div>}
                <div className="set-grid">
                    <div className="set-field">
                        <label>Current Password</label>
                        <input type="password" value={pw.current_password} onChange={(e) => setPw((p) => ({ ...p, current_password: e.target.value }))} placeholder="Current password" />
                    </div>
                    <div className="set-field">
                        <label>New Password</label>
                        <input type="password" value={pw.new_password} onChange={(e) => setPw((p) => ({ ...p, new_password: e.target.value }))} placeholder="New password (min 6 chars)" />
                    </div>
                    <div className="set-field">
                        <label>Confirm New Password</label>
                        <input type="password" value={pw.confirm_password} onChange={(e) => setPw((p) => ({ ...p, confirm_password: e.target.value }))} placeholder="Confirm new password" />
                    </div>
                </div>
                <button className="set-save-btn" onClick={handlePassword} disabled={pwSaving} style={{ marginTop: 12 }}>
                    {pwSaving ? "Changing..." : "Change Password"}
                </button>
            </div>
        </>
    );
}

// ═══════════════════════════════════════════════════════════════
// Tab: Order Number Format
// ═══════════════════════════════════════════════════════════════

const RESET_MODES = [
    { value: "never", label: "Never", desc: "Keep counting up on every order, forever." },
    { value: "daily", label: "Daily", desc: "Restart from the starting number each day." },
    { value: "monthly", label: "Monthly", desc: "Restart from the starting number each month." }
];

const toOrderNumberForm = (row = {}) => ({
    prefix: row.prefix || "ORD",
    starting_number: row.starting_number ?? 1,
    digits: row.digits ?? 4,
    reset_mode: row.reset_mode || "never"
});

const buildPreview = (data) => {
    const prefix = String(data.prefix || "").trim() || "ORD";
    const start = Math.max(1, Math.round(Number(data.starting_number)) || 1);
    const digits = Math.max(1, Math.min(10, Math.round(Number(data.digits)) || 4));
    return `${prefix}-${String(start).padStart(digits, "0")}`;
};

const validateOrderNumberForm = (data) => {
    if (!/^[A-Za-z0-9_-]{1,12}$/.test(String(data.prefix || ""))) return "Prefix must be 1-12 letters, numbers, dashes or underscores.";
    if (!Number.isInteger(Number(data.starting_number)) || Number(data.starting_number) < 1) return "Starting number must be a positive whole number.";
    if (!Number.isInteger(Number(data.digits)) || Number(data.digits) < 1 || Number(data.digits) > 10) return "Number of digits must be between 1 and 10.";
    if (!RESET_MODES.some((m) => m.value === data.reset_mode)) return "Choose a reset mode.";
    return "";
};

function TabOrderNumberFormat() {
    const [data, setData] = useState(null);
    const [saved, setSaved] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        settingsService.getOrderNumberFormat().then((res) => {
            const form = toOrderNumberForm(res.data?.data);
            setData(form);
            setSaved(form);
        }).catch((err) => {
            setError(err.response?.data?.message || "Failed to load order number settings.");
        }).finally(() => setLoading(false));
    }, []);

    const update = (key, value) => {
        setData((prev) => ({ ...prev, [key]: value }));
        setNotice("");
        setError("");
    };

    const dirty = JSON.stringify(data) !== JSON.stringify(saved);

    const handleSave = async () => {
        const problem = validateOrderNumberForm(data);
        if (problem) { setError(problem); return; }

        setSaving(true);
        setNotice("");
        setError("");
        try {
            const res = await settingsService.saveOrderNumberFormat(data);
            const form = toOrderNumberForm(res.data?.data);
            setData(form);
            setSaved(form);
            setNotice("Saved ✓");
        } catch (err) {
            setError("Unable to save changes.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="set-loading">Loading order number settings...</div>;
    if (!data) return <div className="set-alert set-alert-warn">{error || "Failed to load order number settings."}</div>;

    const resetMode = RESET_MODES.find((m) => m.value === data.reset_mode) || RESET_MODES[0];
    const preview = buildPreview(data);

    return (
        <>
            {error && <div className="set-alert set-alert-warn">{error}</div>}
            {notice && <div className="set-alert set-alert-ok">{notice}</div>}

            <section className="set-section">
                <div className="set-section-head">
                    <h3>Order Number Format</h3>
                    <p>
                        Choose how new orders are numbered, for the receipts, bills, kitchen
                        tickets and reports. The number is generated by the server from these
                        settings — existing orders keep the number they were created with, and
                        only new orders use the new format.
                    </p>
                </div>

                <div className="set-grid" style={{ marginTop: 20 }}>
                    <div className="set-field">
                        <label>Prefix</label>
                        <input
                            type="text"
                            value={data.prefix}
                            onChange={(e) => update("prefix", e.target.value.toUpperCase())}
                            placeholder="ORD"
                            maxLength={12}
                        />
                    </div>
                    <div className="set-field">
                        <label>Starting Number</label>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={data.starting_number}
                            onChange={(e) => update("starting_number", e.target.value === "" ? "" : Number(e.target.value))}
                        />
                    </div>
                    <div className="set-field">
                        <label>Number of Digits</label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            step="1"
                            inputMode="numeric"
                            value={data.digits}
                            onChange={(e) => update("digits", e.target.value === "" ? "" : Number(e.target.value))}
                        />
                    </div>
                    <div className="set-field">
                        <label>Reset Sequence</label>
                        <select value={data.reset_mode} onChange={(e) => update("reset_mode", e.target.value)}>
                            {RESET_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        <span className="set-hint">{resetMode.desc}</span>
                    </div>
                </div>
            </section>

            <section className="set-section">
                <div className="set-section-head">
                    <h3>Next Order Number</h3>
                    <p>
                        The first order placed after these settings are saved will be numbered this way
                        {resourceHint(data.reset_mode)}.
                    </p>
                </div>
                <div className="set-number-preview">{preview}</div>
            </section>

            <div className="set-section-footer">
                <button className="set-save-btn" onClick={handleSave} disabled={saving || !dirty}>
                    {saving ? "Saving..." : dirty ? "Save Changes" : "Saved"}
                </button>
            </div>
        </>
    );
}

// The reset-mode sentence in the preview section, so the admin sees exactly what
// "Daily" / "Monthly" will do before they save it.
function resourceHint(mode) {
    if (mode === "daily") return <>; the sequence restarts at the starting number each day</>;
    if (mode === "monthly") return <>; the sequence restarts at the starting number each month</>;
    return "";
}

// ═══════════════════════════════════════════════════════════════
// Tab: Printers & Kitchen (EXISTING — DO NOT CHANGE)
// ═══════════════════════════════════════════════════════════════

function TabPrintersKitchen() {
    const [savedMode, setSavedMode] = useState(DEFAULT_PRINTER_MODE);
    const [mode, setMode] = useState(DEFAULT_PRINTER_MODE);
    // Waiter-can-print-bill toggle: on = waiter prints + settles from the app;
    // off = the waiter's bill goes to the cashier to print + settle.
    const [savedWaiterBill, setSavedWaiterBill] = useState(false);
    const [waiterBill, setWaiterBill] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState("");
    const [loadError, setLoadError] = useState("");

    useEffect(() => {
        loadSetting();
    }, []);

    const loadSetting = async () => {
        setLoading(true);
        try {
            const res = await printerSettingService.getPrinterSetting();
            const current = normalizePrinterMode(res.data?.data?.setting?.printer_mode);
            setSavedMode(current);
            setMode(current);
            const wb = Boolean(Number(res.data?.data?.setting?.waiter_can_print_bill));
            setSavedWaiterBill(wb);
            setWaiterBill(wb);
            setLoadError("");
        } catch (err) {
            console.error("Failed to load printer settings:", err);
            setLoadError(
                err.response?.data?.message ||
                "Could not load the printer setup. Showing the default until the server responds."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (value) => {
        setMode(value);
        setNotice("");
    };

    const handleSave = async () => {
        setSaving(true);
        setNotice("");
        try {
            const res = await printerSettingService.savePrinterSetting({ printer_mode: mode, waiter_can_print_bill: waiterBill ? 1 : 0 });
            const current = normalizePrinterMode(res.data?.data?.setting?.printer_mode);
            setSavedMode(current);
            setMode(current);
            const wb = Boolean(Number(res.data?.data?.setting?.waiter_can_print_bill));
            setSavedWaiterBill(wb);
            setWaiterBill(wb);
            setNotice("Printer setup saved. The cashier and waiter screens pick it up within a few seconds.");
        } catch (err) {
            console.error("Failed to save printer settings:", err);
            alert(err.response?.data?.message || "Could not save the printer setup.");
        } finally {
            setSaving(false);
        }
    };

    const dirty = mode !== savedMode || waiterBill !== savedWaiterBill;

    return (
        <>
            {loadError && <div className="set-alert set-alert-warn">{loadError}</div>}
            {notice && <div className="set-alert set-alert-ok">{notice}</div>}

            <section className="set-section">
                <div className="set-section-head">
                    <h3>Printer Setup</h3>
                    <p>
                        Pick the option that matches the hardware at this restaurant. It decides
                        when a kitchen ticket is printed and when the kitchen just reads a screen.
                    </p>
                </div>

                {loading ? (
                    <div className="set-loading">Loading printer setup...</div>
                ) : (
                    <div className="set-options">
                        {PRINTER_MODE_OPTIONS.map((opt, idx) => {
                            const selected = mode === opt.value;
                            return (
                                <button
                                    type="button"
                                    key={opt.value}
                                    className={`set-option${selected ? " selected" : ""}`}
                                    onClick={() => handleSelect(opt.value)}
                                    disabled={saving}
                                    aria-pressed={selected}
                                >
                                    <div className="set-option-top">
                                        <span className={`set-radio${selected ? " on" : ""}`} />
                                        <div className="set-option-title">
                                            <span className="set-option-index">Option {idx + 1}</span>
                                            <strong>{opt.title}</strong>
                                            <span className="set-option-sub">{opt.subtitle}</span>
                                        </div>
                                        {opt.value === savedMode && (
                                            <span className="set-active-chip">Active</span>
                                        )}
                                    </div>

                                    <p className="set-option-desc">{opt.description}</p>

                                    <ul className="set-option-flow">
                                        {opt.flow.map((line) => (
                                            <li key={line}>{line}</li>
                                        ))}
                                    </ul>
                                </button>
                            );
                        })}
                    </div>
                )}

                <p className="set-footnote">
                    Choosing the printer devices themselves is done on the cashier screen — this
                    page only sets which setup the restaurant runs.
                </p>

                {!loading && (
                    <label className="set-toggle-row">
                        <span className="set-toggle-text">
                            <strong>Waiter can print the bill directly</strong>
                            <span className="set-toggle-sub">
                                On: the waiter picks the payment method, prints the bill and closes
                                the table from the app. Off: the waiter&apos;s bill goes to the
                                cashier, who is notified the table is billed and prints it.
                            </span>
                        </span>
                        <input
                            type="checkbox"
                            className="set-toggle-input"
                            checked={waiterBill}
                            disabled={saving}
                            onChange={(e) => { setWaiterBill(e.target.checked); setNotice(""); }}
                        />
                    </label>
                )}
            </section>

            <div className="set-section-footer">
                <button className="set-save-btn" onClick={handleSave} disabled={loading || saving || !dirty}>
                    {saving ? "Saving..." : dirty ? "Save Changes" : "Saved"}
                </button>
            </div>
        </>
    );
}

// ═══════════════════════════════════════════════════════════════
// Main Settings Component
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Tab: Discounts (salon) — what the front desk may take off a bill
// ═══════════════════════════════════════════════════════════════

const toDiscountForm = (row = {}) => ({
    discount_enabled: Boolean(Number(row.discount_enabled)),
    discount_max_percent: String(Number(row.discount_max_percent) || 0),
    discount_max_amount: String(Number(row.discount_max_amount) || 0)
});

function TabDiscounts() {
    const [data, setData] = useState(null);
    const [saved, setSaved] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    useEffect(() => {
        let live = true;
        settingsService.getRestaurant()
            .then((res) => {
                if (!live) return;
                const form = toDiscountForm(res.data?.data);
                setData(form);
                setSaved(form);
            })
            .catch((err) => {
                if (live) setError(err.response?.data?.message || "Failed to load discount settings.");
            })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, []);

    const update = (field, value) => {
        setData((prev) => ({ ...prev, [field]: value }));
        setNotice("");
        setError("");
    };

    const handleSave = async () => {
        const pct = Number(data.discount_max_percent || 0);
        const amt = Number(data.discount_max_amount || 0);
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) { setError("Maximum percentage must be between 0 and 100."); return; }
        if (!Number.isFinite(amt) || amt < 0) { setError("Maximum amount must be 0 or more."); return; }
        if (data.discount_enabled && pct === 0 && amt === 0) { setError("Set a maximum percentage, a maximum amount, or both."); return; }

        setSaving(true);
        try {
            const res = await settingsService.saveDiscounts({
                discount_enabled: data.discount_enabled,
                discount_max_percent: pct,
                discount_max_amount: amt
            });
            const form = toDiscountForm(res.data?.data);
            setData(form);
            setSaved(form);
            setNotice("Discount rules saved. The front desk picks them up within a few seconds.");
        } catch (err) {
            setError(err.response?.data?.message || "Could not save discount settings.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="set-loading">Loading discount settings...</div>;
    if (!data) return <div className="set-alert set-alert-warn">{error || "Failed to load discount settings."}</div>;

    const dirty = JSON.stringify(data) !== JSON.stringify(saved);
    const hint = { display: "block", marginTop: 6, fontSize: 12, color: "#64748B" };

    return (
        <>
            {error && <div className="set-alert set-alert-warn">{error}</div>}
            {notice && <div className="set-alert set-alert-ok">{notice}</div>}

            <div className="set-section-inner">
                <h4>Receptionist Discounts</h4>
                <div className="set-payment-methods">
                    <div className="set-payment-row">
                        <div className="set-payment-info">
                            <strong>Allow discounts at the front desk</strong>
                            <span>
                                Off: every bill is charged in full. On: the receptionist can take
                                a discount off a bill, up to the limits below. GST is worked out on
                                the amount after the discount.
                            </span>
                        </div>
                        <button
                            type="button"
                            className={`set-switch${data.discount_enabled ? " on" : ""}`}
                            onClick={() => update("discount_enabled", !data.discount_enabled)}
                            disabled={saving}
                            aria-pressed={data.discount_enabled}
                            aria-label="Allow discounts at the front desk"
                        >
                            <span className="set-switch-track"><span className="set-switch-thumb" /></span>
                        </button>
                    </div>
                </div>
            </div>

            {data.discount_enabled && (
                <div className="set-section-inner">
                    <h4>Limits per bill</h4>
                    <div className="set-grid">
                        <div className="set-field">
                            <label htmlFor="disc-max-pct">Maximum discount (%)</label>
                            <input
                                id="disc-max-pct"
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                inputMode="decimal"
                                value={data.discount_max_percent}
                                onChange={(e) => update("discount_max_percent", e.target.value)}
                            />
                            <span style={hint}>e.g. 10 lets the desk give up to 10% off. 0 = no percentage discounts.</span>
                        </div>
                        <div className="set-field">
                            <label htmlFor="disc-max-amt">Maximum discount (₹)</label>
                            <input
                                id="disc-max-amt"
                                type="number"
                                min="0"
                                step="1"
                                inputMode="decimal"
                                value={data.discount_max_amount}
                                onChange={(e) => update("discount_max_amount", e.target.value)}
                            />
                            <span style={hint}>e.g. 200 lets the desk take up to ₹200 off. 0 = no flat-amount discounts.</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="set-section-footer">
                <button className="set-save-btn" onClick={handleSave} disabled={saving || !dirty}>
                    {saving ? "Saving..." : dirty ? "Save Changes" : "Saved"}
                </button>
            </div>
        </>
    );
}

// ═══════════════════════════════════════════════════════════════
// Tab: Bills & WhatsApp (salon) — printer or not, and the message text
// ═══════════════════════════════════════════════════════════════

const BILL_DELIVERY_OPTIONS = [
    {
        value: BILL_DELIVERY.PRINTER_OPTIONAL,
        title: "Printer optional",
        subtitle: "Print or WhatsApp at payment",
        description: "The salon has a bill printer, but not every customer wants paper.",
        flow: [
            "Payment shows two buttons: Send on WhatsApp and Print",
            "Send on WhatsApp: no paper, WhatsApp opens with the bill",
            "Print: prints the bill and opens WhatsApp with it too"
        ]
    },
    {
        value: BILL_DELIVERY.NO_PRINTER,
        title: "No printer",
        subtitle: "Bills go on WhatsApp only",
        description: "There is no bill printer at the front desk.",
        flow: [
            "Payment shows one button: Send on WhatsApp",
            "The till's Printer screen is hidden"
        ]
    }
];

// WhatsApp's *bold*, drawn as bold in the preview.
const renderWhatsAppLine = (line) =>
    line.split(/(\*[^*\n]+\*)/).map((part, i) =>
        /^\*[^*\n]+\*$/.test(part)
            ? <strong key={i}>{part.slice(1, -1)}</strong>
            : <React.Fragment key={i}>{part}</React.Fragment>
    );

const toWhatsAppForm = (row = {}) => ({
    bill_delivery: normalizeBillDelivery(row.bill_delivery),
    whatsapp_template: row.whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE,
    // Salon-wide default for which WhatsApp bills open in. A till can override it.
    whatsapp_via: row.whatsapp_via === "app" ? "app" : "web"
});

function TabBillsWhatsApp() {
    const [data, setData] = useState(null);
    const [saved, setSaved] = useState(null);
    const [shop, setShop] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const textRef = useRef(null);

    useEffect(() => {
        let live = true;
        settingsService.getRestaurant()
            .then((res) => {
                if (!live) return;
                const row = res.data?.data || {};
                const form = toWhatsAppForm(row);
                setData(form);
                setSaved(form);
                setShop(row);
            })
            .catch((err) => {
                if (live) setError(err.response?.data?.message || "Failed to load bill settings.");
            })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, []);

    const update = (field, value) => {
        setData((prev) => ({ ...prev, [field]: value }));
        setNotice("");
        setError("");
    };

    // Put a {tag} where the cursor is, and leave the cursor after it.
    const insertTag = (tag) => {
        const el = textRef.current;
        const text = data.whatsapp_template;
        const start = el ? el.selectionStart : text.length;
        const end = el ? el.selectionEnd : text.length;
        update("whatsapp_template", text.slice(0, start) + tag + text.slice(end));
        requestAnimationFrame(() => {
            if (!el) return;
            el.focus();
            el.setSelectionRange(start + tag.length, start + tag.length);
        });
    };

    const handleSave = async () => {
        if (!data.whatsapp_template.trim()) { setError("The WhatsApp message can't be empty. Use Reset to default to start again."); return; }
        if (data.whatsapp_template.length > WHATSAPP_TEMPLATE_MAX) { setError(`The WhatsApp message can be at most ${WHATSAPP_TEMPLATE_MAX} characters.`); return; }

        setSaving(true);
        try {
            const res = await settingsService.saveWhatsApp({
                bill_delivery: data.bill_delivery,
                whatsapp_via: data.whatsapp_via,
                // The default is stored as "not customised", so a later
                // improvement to the default reaches salons that never edited it.
                whatsapp_template: data.whatsapp_template === DEFAULT_WHATSAPP_TEMPLATE ? "" : data.whatsapp_template
            });
            const row = res.data?.data || {};
            const form = toWhatsAppForm(row);
            setData(form);
            setSaved(form);
            setShop(row);
            setNotice("Saved. The front desk picks it up within a few seconds.");
        } catch (err) {
            setError(err.response?.data?.message || "Could not save bill settings.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="set-loading">Loading bill settings...</div>;
    if (!data) return <div className="set-alert set-alert-warn">{error || "Failed to load bill settings."}</div>;

    const dirty = JSON.stringify(data) !== JSON.stringify(saved);
    const shopNumber = shop.shop_mobile || "";
    const preview = buildBillMessage(
        SAMPLE_BILL,
        { restaurant_name: shop.restaurant_name || shop.shop_name || "Your Salon", address: shop.address, mobile: shopNumber },
        data.whatsapp_template
    );

    return (
        <>
            {error && <div className="set-alert set-alert-warn">{error}</div>}
            {notice && <div className="set-alert set-alert-ok">{notice}</div>}

            <section className="set-section">
                <div className="set-section-head">
                    <h3>Bill printer</h3>
                    <p>How the front desk hands a bill to the customer after payment.</p>
                </div>
                <div className="set-options">
                    {BILL_DELIVERY_OPTIONS.map((opt, idx) => {
                        const selected = data.bill_delivery === opt.value;
                        return (
                            <button
                                type="button"
                                key={opt.value}
                                className={`set-option${selected ? " selected" : ""}`}
                                onClick={() => update("bill_delivery", opt.value)}
                                disabled={saving}
                                aria-pressed={selected}
                            >
                                <div className="set-option-top">
                                    <span className={`set-radio${selected ? " on" : ""}`} />
                                    <div className="set-option-title">
                                        <span className="set-option-index">Option {idx + 1}</span>
                                        <strong>{opt.title}</strong>
                                        <span className="set-option-sub">{opt.subtitle}</span>
                                    </div>
                                    {opt.value === saved.bill_delivery && (
                                        <span className="set-active-chip">Active</span>
                                    )}
                                </div>
                                <p className="set-option-desc">{opt.description}</p>
                                <ul className="set-option-flow">
                                    {opt.flow.map((line) => <li key={line}>{line}</li>)}
                                </ul>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="set-section">
                <div className="set-section-head">
                    <h3>Open bills in</h3>
                    <p>Whether a bill opens in WhatsApp Web (browser) or the installed WhatsApp desktop app. A till can override this on its own screen if it needs to.</p>
                </div>
                <div className="set-field">
                    <select
                        className="set-select"
                        value={data.whatsapp_via}
                        onChange={(e) => update("whatsapp_via", e.target.value)}
                        disabled={saving}
                        aria-label="Open bills in"
                    >
                        <option value="web">WhatsApp Web (browser)</option>
                        <option value="app">WhatsApp app (desktop)</option>
                    </select>
                    <p className="set-hint">"App" needs WhatsApp Desktop installed on the till PC.</p>
                </div>
            </section>

            <section className="set-section">
                <div className="set-section-head">
                    <h3>WhatsApp message</h3>
                    <p>
                        The text the customer gets. Click a tag to add it where the cursor is — it is
                        filled in from each bill. A line whose tags are empty is left out.
                    </p>
                </div>

                <div className="set-wa-layout">
                    <div className="set-wa-editor">
                        <div className="set-wa-tags">
                            {WHATSAPP_TAGS.map((t) => (
                                <button
                                    type="button"
                                    key={t.tag}
                                    className="set-wa-tag"
                                    onClick={() => insertTag(t.tag)}
                                    title={t.label}
                                    disabled={saving}
                                >
                                    {t.tag}
                                </button>
                            ))}
                        </div>
                        <textarea
                            ref={textRef}
                            className="set-wa-textarea"
                            value={data.whatsapp_template}
                            onChange={(e) => update("whatsapp_template", e.target.value)}
                            rows={16}
                            maxLength={WHATSAPP_TEMPLATE_MAX}
                            aria-label="WhatsApp message"
                            spellCheck={false}
                        />
                        <div className="set-wa-meta">
                            <span>
                                Use *stars* for <strong>bold</strong>. {data.whatsapp_template.length} / {WHATSAPP_TEMPLATE_MAX}
                            </span>
                            <button
                                type="button"
                                className="set-wa-reset"
                                onClick={() => update("whatsapp_template", DEFAULT_WHATSAPP_TEMPLATE)}
                                disabled={saving || data.whatsapp_template === DEFAULT_WHATSAPP_TEMPLATE}
                            >
                                Reset to default
                            </button>
                        </div>
                        <p className="set-footnote">
                            {shopNumber
                                ? <>{"{salon_phone}"} is the shop number <strong>{shopNumber}</strong> — the mobile given when this salon was created.</>
                                : <>{"{salon_phone}"} is the mobile given when this salon was created. None is on record, so that line is left out.</>}
                        </p>
                    </div>

                    <div className="set-wa-preview-wrap">
                        <span className="set-wa-preview-label">Preview (sample bill)</span>
                        <div className="set-wa-preview">
                            {preview.split("\n").map((line, i) => (
                                <div key={i} className="set-wa-preview-line">{line ? renderWhatsAppLine(line) : " "}</div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <div className="set-section-footer">
                <button className="set-save-btn" onClick={handleSave} disabled={saving || !dirty}>
                    {saving ? "Saving..." : dirty ? "Save Changes" : "Saved"}
                </button>
            </div>
        </>
    );
}

function Settings() {
    const [activeTab, setActiveTab] = useState("restaurant");

    // A salon has no waiter / kitchen roles to set permissions for and no
    // kitchen printer setup — it prints one bill at the counter, configured
    // on the till's Printer screen.
    const salon = isSalon();
    const tabs = salon
        ? [
            { key: "restaurant", label: "Salon" },
            { key: "payments", label: "Payments" },
            { key: "discounts", label: "Discounts" },
            { key: "whatsapp", label: "Bills & WhatsApp" },
            { key: "security", label: "Security" },
            { key: "order-number-format", label: "Order Number Format" }
        ]
        : TABS;

    const TAB_CONTENT = {
        restaurant: <TabRestaurant />,
        payments: <TabPayments />,
        discounts: <TabDiscounts />,
        whatsapp: <TabBillsWhatsApp />,
        staff: <TabStaffPermissions />,
        security: <TabSecurity />,
        printers: <TabPrintersKitchen />,
        "order-number-format": <TabOrderNumberFormat />
    };

    return (
        <AdminLayout>
            <div className="dashboard-content settings-page">
                <div className="set-page-header">
                    <div>
                        <h2>Settings</h2>
                        <p>
                            {salon
                                ? "Manage your salon details, payments, discounts, bills on WhatsApp and security."
                                : "Manage your restaurant configuration, payments, staff permissions, and printer setup."}
                        </p>
                    </div>
                </div>

                <div className="set-tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            className={`set-tab${activeTab === tab.key ? " active" : ""}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="set-tab-content">
                    {TAB_CONTENT[activeTab]}
                </div>
            </div>
        </AdminLayout>
    );
}

export default Settings;
