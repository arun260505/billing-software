import { useCallback, useEffect, useState } from "react";
import printerSettingService from "../../services/printerSettingService";
import { getPrinters } from "../../services/systemService";
import { printTestNow } from "../../utils/printDispatch";
import {
    DEFAULT_PRINTER_MODE,
    normalizePrinterMode,
    requiredPrinters,
    PRINTER_MODE_OPTIONS
} from "../../utils/printerMode";
import "../../styles/Cashier/PrinterSetup.css";

/**
 * The cashier's Printer page.
 *
 * The admin picks the printer *setup* (Admin → Settings); this page connects the
 * actual printers that setup calls for — one box for a single-printer setup, two
 * for the cashier + kitchen setup. The names are saved per restaurant so the till
 * keeps them after a reinstall.
 *
 * Status is read from the printers Windows actually has installed on the machine
 * running the backend. In exe mode that is this till, so the status is real. When
 * the backend is a cloud server it cannot see the till's printers, and the page
 * says so rather than showing a status it cannot know.
 */
function PrinterSetup() {

    const [mode, setMode] = useState(DEFAULT_PRINTER_MODE);
    const [values, setValues] = useState({ cashier_printer: "", kitchen_printer: "" });
    const [saved, setSaved] = useState({ cashier_printer: "", kitchen_printer: "" });

    const [available, setAvailable] = useState([]);      // printers installed on the till
    const [detectable, setDetectable] = useState(false);
    const [detectReason, setDetectReason] = useState("");
    const [detecting, setDetecting] = useState(true);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState("");
    const [loadError, setLoadError] = useState("");

    const slots = requiredPrinters(mode);

    const loadSetting = useCallback(async () => {
        setLoading(true);
        try {
            const res = await printerSettingService.getPrinterSetting();
            const setting = res.data?.data?.setting || {};
            const stored = {
                cashier_printer: setting.cashier_printer || "",
                kitchen_printer: setting.kitchen_printer || ""
            };
            setMode(normalizePrinterMode(setting.printer_mode));
            setValues(stored);
            setSaved(stored);
            setLoadError("");
        } catch (e) {
            console.error("Failed to load printer settings:", e);
            setLoadError("Could not load the printer setup from the server.");
        } finally {
            setLoading(false);
        }
    }, []);

    const loadPrinters = useCallback(async () => {
        setDetecting(true);
        try {
            const res = await getPrinters();
            setAvailable(res.data?.printers || []);
            setDetectable(Boolean(res.data?.detectable));
            setDetectReason(res.data?.reason || "");
        } catch (e) {
            console.error("Failed to detect printers:", e);
            setAvailable([]);
            setDetectable(false);
            setDetectReason("Could not reach the server to read the printer list.");
        } finally {
            setDetecting(false);
        }
    }, []);

    useEffect(() => {
        loadSetting();
        loadPrinters();
    }, [loadSetting, loadPrinters]);

    const setValue = (key, value) => {
        setValues((prev) => ({ ...prev, [key]: value }));
        setFlash("");
    };

    // What we can honestly say about one configured printer.
    const statusOf = (name) => {
        const chosen = (name || "").trim();
        if (!chosen) return { key: "unset", label: "Not set" };
        if (!detectable) return { key: "unknown", label: "Saved (status unavailable here)" };

        const match = available.find(
            (p) => p.name.toLowerCase() === chosen.toLowerCase()
        );
        if (!match) return { key: "missing", label: "Not installed on this PC" };
        if (match.offline) return { key: "offline", label: "Offline" };
        if (/error|paperout|paperjam|paused|notavailable/i.test(match.status)) {
            return { key: "offline", label: match.status };
        }
        return { key: "ok", label: "Connected" };
    };

    // Only the boxes this setup actually asks for have to be filled in.
    const missingRequired = slots.filter((s) => !(values[s.key] || "").trim());
    const dirty = slots.some((s) => (values[s.key] || "") !== (saved[s.key] || ""));

    const handleSave = async () => {
        if (missingRequired.length > 0) {
            setFlash(`Choose a printer for: ${missingRequired.map((s) => s.label).join(", ")}.`);
            return;
        }

        setSaving(true);
        setFlash("");
        try {
            // Only send the slots this setup uses, so switching modes never leaves
            // a stale name behind on the unused one.
            const payload = { cashier_printer: null, kitchen_printer: null };
            slots.forEach((s) => { payload[s.key] = (values[s.key] || "").trim() || null; });

            const res = await printerSettingService.savePrinterDevices(payload);
            const setting = res.data?.data?.setting || {};
            const stored = {
                cashier_printer: setting.cashier_printer || "",
                kitchen_printer: setting.kitchen_printer || ""
            };
            setValues(stored);
            setSaved(stored);
            setFlash("Printers saved.");
            setTimeout(() => setFlash(""), 3000);
        } catch (e) {
            console.error("Failed to save printers:", e);
            setFlash(e.response?.data?.message || "Could not save the printers.");
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async (slot) => {
        const name = (values[slot.key] || "").trim();
        if (!name) {
            setFlash(`Choose a ${slot.label.toLowerCase()} first.`);
            return;
        }

        // A test print goes to the printer that is actually saved, so test after
        // saving — otherwise it exercises the previously saved device.
        if (name !== (saved[slot.key] || "")) {
            setFlash("Save first, then test — the test prints to the saved printer.");
            return;
        }

        setFlash("Sending test print…");
        const res = await printTestNow({
            printerName: name,
            role: slot.role,
            target: slot.key === "kitchen_printer" ? "kitchen" : "cashier"
        });

        setFlash(
            res.direct
                ? `Test sent to ${res.printer || name}.`
                : `Could not print directly (${res.reason}) — opened the print dialog instead.`
        );
        setTimeout(() => setFlash(""), 6000);
    };

    const activeOption = PRINTER_MODE_OPTIONS.find((o) => o.value === mode);

    return (
        <div className="prn-wrap">
            <div className="prn-card">

                <h2 className="prn-title">🖨 Printer</h2>
                <p className="prn-sub">
                    Connect the printers this till uses. Which ones are needed comes from
                    the setup your admin chose — change that in Admin → Settings.
                </p>

                {loadError && <div className="prn-alert warn">{loadError}</div>}

                {/* Which setup is running */}
                <div className="prn-mode">
                    <span className="prn-mode-label">Setup</span>
                    <div className="prn-mode-body">
                        <strong>{activeOption?.title || mode}</strong>
                        <span className="prn-mode-sub">{activeOption?.subtitle}</span>
                    </div>
                    <span className="prn-mode-count">
                        {slots.length === 1 ? "1 printer" : `${slots.length} printers`}
                    </span>
                </div>

                {/* Where the status comes from */}
                <div className={`prn-detect${detectable ? " ok" : ""}`}>
                    <span className="prn-detect-text">
                        {detecting
                            ? "Reading the printers installed on this PC…"
                            : detectable
                                ? `${available.length} printer${available.length === 1 ? "" : "s"} installed on this PC.`
                                : detectReason || "The printer list is not available here."}
                    </span>
                    <button className="prn-btn ghost" onClick={loadPrinters} disabled={detecting}>
                        ↻ Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="prn-loading">Loading…</div>
                ) : (
                    <>
                        {slots.map((slot) => {
                            const status = statusOf(values[slot.key]);
                            return (
                                <div className="prn-slot" key={slot.key}>
                                    <div className="prn-slot-head">
                                        <div className="prn-slot-title">
                                            <strong>{slot.label}</strong>
                                            <span className="prn-slot-role">{slot.role}</span>
                                        </div>
                                        <span className={`prn-status ${status.key}`}>
                                            <span className="prn-dot" />
                                            {status.label}
                                        </span>
                                    </div>

                                    <div className="prn-entry">
                                        {detectable && available.length > 0 ? (
                                            <select
                                                className="prn-select"
                                                value={
                                                    available.some((p) => p.name === values[slot.key])
                                                        ? values[slot.key]
                                                        : ""
                                                }
                                                onChange={(e) => setValue(slot.key, e.target.value)}
                                                disabled={saving}
                                            >
                                                <option value="">— Choose a printer —</option>
                                                {available.map((p) => (
                                                    <option key={p.name} value={p.name}>
                                                        {p.name}{p.offline ? " (offline)" : ""}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                className="prn-input"
                                                value={values[slot.key] || ""}
                                                onChange={(e) => setValue(slot.key, e.target.value)}
                                                placeholder="Exact printer name, e.g. EPSON TM-T82"
                                                disabled={saving}
                                            />
                                        )}

                                        <button
                                            className="prn-btn ghost"
                                            onClick={() => handleTest(slot)}
                                            disabled={saving}
                                        >
                                            Test print
                                        </button>
                                    </div>

                                    {/* A name saved earlier that this PC no longer has: keep it
                                        visible and editable instead of silently dropping it. */}
                                    {detectable
                                        && (values[slot.key] || "").trim()
                                        && !available.some((p) => p.name === values[slot.key]) && (
                                        <div className="prn-orphan">
                                            Saved as <b>{values[slot.key]}</b>, which is not installed on
                                            this PC. Pick one from the list, or{" "}
                                            <button
                                                className="prn-link"
                                                onClick={() => setValue(slot.key, "")}
                                            >
                                                clear it
                                            </button>.
                                        </div>
                                    )}

                                    <div className="prn-hint">{slot.hint}</div>
                                </div>
                            );
                        })}

                        <div className="prn-actions">
                            <button
                                className="prn-btn primary"
                                onClick={handleSave}
                                disabled={saving || !dirty}
                            >
                                {saving ? "Saving…" : dirty ? "Save printers" : "Saved"}
                            </button>
                            {flash && <span className="prn-flash">{flash}</span>}
                        </div>
                    </>
                )}

                <p className="prn-note">
                    Printing goes through the browser's print dialog, so pick the same
                    printer there when it opens. Set it as the Windows default printer to
                    make that automatic.
                </p>

            </div>
        </div>
    );
}

export default PrinterSetup;
