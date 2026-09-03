import React, { useEffect, useState } from "react";
import AdminLayout from "../../layouts/AdminLayout";
import printerSettingService from "../../services/printerSettingService";
import {
    PRINTER_MODE_OPTIONS,
    DEFAULT_PRINTER_MODE,
    normalizePrinterMode
} from "../../utils/printerMode";

import "../../styles/pages/Admin/Settings.css";

function Settings() {

    // `savedMode` is what the restaurant is running right now; `mode` is what the
    // admin has clicked. Save is only offered while the two differ.
    const [savedMode, setSavedMode] = useState(DEFAULT_PRINTER_MODE);
    const [mode, setMode] = useState(DEFAULT_PRINTER_MODE);
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
            const res = await printerSettingService.savePrinterSetting({ printer_mode: mode });
            const current = normalizePrinterMode(res.data?.data?.setting?.printer_mode);
            setSavedMode(current);
            setMode(current);
            setNotice("Printer setup saved. The cashier and waiter screens pick it up within a few seconds.");
        } catch (err) {
            console.error("Failed to save printer settings:", err);
            alert(err.response?.data?.message || "Could not save the printer setup.");
        } finally {
            setSaving(false);
        }
    };

    const dirty = mode !== savedMode;

    return (
        <AdminLayout>
            <div className="dashboard-content settings-page">

                <div className="set-page-header">
                    <div>
                        <h2>Settings</h2>
                        <p>Configure how this restaurant's printers and kitchen display work together.</p>
                    </div>
                    <button
                        className="set-save-btn"
                        onClick={handleSave}
                        disabled={loading || saving || !dirty}
                    >
                        {saving ? "Saving..." : dirty ? "Save Changes" : "Saved"}
                    </button>
                </div>

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
                </section>

            </div>
        </AdminLayout>
    );
}

export default Settings;
