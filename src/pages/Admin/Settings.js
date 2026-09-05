import React, { useEffect, useState, useCallback } from "react";
import AdminLayout from "../../layouts/AdminLayout";
import printerSettingService from "../../services/printerSettingService";
import settingsService from "../../services/settingsService";
import {
    PRINTER_MODE_OPTIONS,
    DEFAULT_PRINTER_MODE,
    normalizePrinterMode
} from "../../utils/printerMode";

import "../../styles/pages/Admin/Settings.css";

const TABS = [
    { key: "restaurant", label: "Restaurant" },
    { key: "payments", label: "Payments" },
    { key: "staff", label: "Staff & Permissions" },
    { key: "security", label: "Security" },
    { key: "printers", label: "Printers & Kitchen" }
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
            setError(err.response?.data?.message || "Failed to load restaurant settings.");
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
            setError(err.response?.data?.message || "Could not save restaurant settings.");
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

    if (loading) return <div className="set-loading">Loading restaurant settings...</div>;

    return (
        <>
            {error && <div className="set-alert set-alert-warn">{error}</div>}
            {notice && <div className="set-alert set-alert-ok">{notice}</div>}

            <div className="set-grid">
                <div className="set-field">
                    <label>Restaurant Name</label>
                    <input type="text" value={data?.restaurant_name || ""} onChange={(e) => update("restaurant_name", e.target.value)} placeholder="Restaurant name" />
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
                    <textarea value={data?.address || ""} onChange={(e) => update("address", e.target.value)} placeholder="Restaurant address" rows={2} />
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
                    <label>Restaurant Status</label>
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
        { key: "discount_approval", label: "Discounts", desc: "Require admin approval before applying discounts." },
        { key: "refund_approval", label: "Refunds", desc: "Require admin approval before processing refunds." },
        { key: "cancel_order_approval", label: "Cancel Completed Orders", desc: "Require admin approval before cancelling orders." },
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

function Settings() {
    const [activeTab, setActiveTab] = useState("restaurant");

    const TAB_CONTENT = {
        restaurant: <TabRestaurant />,
        payments: <TabPayments />,
        staff: <TabStaffPermissions />,
        security: <TabSecurity />,
        printers: <TabPrintersKitchen />
    };

    return (
        <AdminLayout>
            <div className="dashboard-content settings-page">
                <div className="set-page-header">
                    <div>
                        <h2>Settings</h2>
                        <p>Manage your restaurant configuration, payments, staff permissions, and printer setup.</p>
                    </div>
                </div>

                <div className="set-tabs">
                    {TABS.map((tab) => (
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
