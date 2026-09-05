import React, { useState, useEffect } from "react";
import { FaTimes, FaChevronDown, FaChevronRight } from "react-icons/fa";
import useEscapeClose from "../../../hooks/useEscapeClose";

function ChargeModal({ show, onClose, onSave, charge, isEditMode }) {

    // Esc closes this modal (src/hooks/useEscapeClose.js).
    useEscapeClose(onClose);

    const initial = {
        charge_name: "",
        description: "",
        charge_type: "Fixed",
        // 'Charge' | 'Tax' | 'Service'. GST and the service charge are charge
        // rows like any other — the role only decides which line of the bill
        // they land on, and keeps tax separable for GST reporting.
        charge_role: "Charge",
        amount: "",
        auto_apply: false,
        applies_dinein: true,
        applies_takeaway: false,
        applies_delivery: false,
        apply_tax: true,
        status: "Active"
    };

    const [form, setForm] = useState(initial);
    const [errors, setErrors] = useState({});
    const [showAdvanced, setShowAdvanced] = useState(false);

    useEffect(() => {
        if (isEditMode && charge) {
            setForm({
                charge_name: charge.charge_name || "",
                description: charge.description || "",
                charge_type: charge.charge_type || "Fixed",
                charge_role: charge.charge_role || "Charge",
                amount: charge.amount || "",
                auto_apply: Boolean(Number(charge.auto_apply)),
                applies_dinein: Boolean(charge.applies_dinein),
                applies_takeaway: Boolean(charge.applies_takeaway),
                applies_delivery: Boolean(charge.applies_delivery),
                apply_tax: Boolean(charge.apply_tax),
                status: charge.status || "Active"
            });
        } else {
            setForm(initial);
        }
        setErrors({});
        setShowAdvanced(false);
        // eslint-disable-next-line
    }, [charge, isEditMode, show]);

    const isTaxLike = form.charge_role !== "Charge";

    const validate = () => {
        const e = {};
        if (!form.charge_name.trim()) e.charge_name = "Charge name is required.";
        if (!form.amount || Number(form.amount) <= 0) e.amount = "Enter a valid amount.";
        if (!form.applies_dinein && !form.applies_takeaway && !form.applies_delivery) {
            e.applies = "Select at least one option.";
        }
        // Per-item / per-person / per-hour have no meaning as a tax and would
        // quietly bill the wrong figure, so the backend refuses them too.
        if (isTaxLike && !["Fixed", "Percentage"].includes(form.charge_type)) {
            e.charge_type = "A tax or service charge must be a percentage or a fixed amount.";
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validate()) return;
        onSave({
            ...form,
            amount: Number(form.amount),
            // A tax the cashier could forget to tap is not a tax.
            auto_apply: isTaxLike ? true : form.auto_apply
        });
    };

    const setRole = (role) => {
        setForm((prev) => ({
            ...prev,
            charge_role: role,
            // Tax and service are all but always a percentage of the bill.
            charge_type: role === "Charge" ? prev.charge_type : "Percentage",
            auto_apply: role === "Charge" ? prev.auto_apply : true
        }));
    };

    const toggleApply = (key) => {
        setForm((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    if (!show) return null;

    return (
        <div className="charge-modal-overlay" onClick={onClose}>
            <div className="charge-modal" onClick={(e) => e.stopPropagation()}>
                <div className="charge-modal-header">
                    <h2>{isEditMode ? "Edit Charge" : "Add New Charge"}</h2>
                    <button className="close-btn" onClick={onClose}><FaTimes /></button>
                </div>
                <p className="charge-modal-subtitle">
                    {isEditMode
                        ? "Update billing charge configuration."
                        : "Create a billing charge for this restaurant."}
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="charge-modal-body">

                        {/* What this charge IS. GST and the service charge are
                            rows in this table too — the role decides which line
                            of the bill they land on and keeps tax separable for
                            GST reporting. */}
                        <div className="charge-form-group">
                            <label>This charge is</label>
                            <div className="applies-cards">
                                <div
                                    className={`applies-card ${form.charge_role === "Charge" ? "selected" : ""}`}
                                    onClick={() => setRole("Charge")}
                                >
                                    🧾 A charge
                                </div>
                                <div
                                    className={`applies-card ${form.charge_role === "Tax" ? "selected" : ""}`}
                                    onClick={() => setRole("Tax")}
                                >
                                    🏛 GST / Tax
                                </div>
                                <div
                                    className={`applies-card ${form.charge_role === "Service" ? "selected" : ""}`}
                                    onClick={() => setRole("Service")}
                                >
                                    🛎 Service Charge
                                </div>
                            </div>
                            <p className="logo-help-text" style={{ marginTop: "6px" }}>
                                {form.charge_role === "Tax"
                                    ? "Adds up into the bill's tax line and the GST figure in Reports. Not registered for GST? Don't create one."
                                    : form.charge_role === "Service"
                                        ? "Adds up into the bill's service-charge line. Delete it to stop levying a service charge."
                                        : "Packing, delivery, AC — priced on top of the goods and listed separately on the bill."}
                            </p>
                        </div>

                        {/* Charge Name */}
                        <div className="charge-form-group">
                            <label>Charge Name</label>
                            <input
                                type="text"
                                placeholder={
                                    form.charge_role === "Tax" ? "e.g. GST 5%"
                                        : form.charge_role === "Service" ? "e.g. Service Charge 2%"
                                            : "e.g. AC Charge"
                                }
                                value={form.charge_name}
                                onChange={(e) => setForm({ ...form, charge_name: e.target.value })}
                            />
                            <p className="logo-help-text" style={{ marginTop: "4px" }}>
                                This is printed on the customer's bill exactly as typed.
                            </p>
                            {errors.charge_name && <div className="field-error">{errors.charge_name}</div>}
                        </div>

                        {/* Description */}
                        <div className="charge-form-group">
                            <label>Description <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span></label>
                            <textarea
                                rows="2"
                                placeholder="Brief description of this charge"
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                            />
                        </div>

                        {/* Type & Amount */}
                        <div className="charge-form-row">
                            <div className="charge-form-group">
                                <label>Charge Type</label>
                                <select
                                    value={form.charge_type}
                                    onChange={(e) => setForm({ ...form, charge_type: e.target.value })}
                                >
                                    <option value="Fixed">Fixed Amount</option>
                                    <option value="Percentage">Percentage</option>
                                    {!isTaxLike && <option value="Per Item">Per Item</option>}
                                    {!isTaxLike && <option value="Per Person">Per Person</option>}
                                    {!isTaxLike && <option value="Per Table">Per Table</option>}
                                    {!isTaxLike && <option value="Per Hour">Per Hour</option>}
                                </select>
                                {errors.charge_type && <div className="field-error">{errors.charge_type}</div>}
                            </div>
                            <div className="charge-form-group">
                                <label>{form.charge_type === "Percentage" ? "Rate" : "Amount"}</label>
                                <div className="amount-input-wrap">
                                    <span className="currency-prefix">{form.charge_type === "Percentage" ? "%" : "₹"}</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0"
                                        value={form.amount}
                                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                    />
                                </div>
                                {errors.amount && <div className="field-error">{errors.amount}</div>}
                            </div>
                        </div>

                        {/* Applies To */}
                        <div className="charge-form-group">
                            <label>Applies To</label>
                            <div className="applies-cards">
                                <div
                                    className={`applies-card ${form.applies_dinein ? "selected" : ""}`}
                                    onClick={() => toggleApply("applies_dinein")}
                                >
                                    🍽 Dine-in
                                </div>
                                <div
                                    className={`applies-card ${form.applies_takeaway ? "selected" : ""}`}
                                    onClick={() => toggleApply("applies_takeaway")}
                                >
                                    🛍 Takeaway
                                </div>
                                <div
                                    className={`applies-card ${form.applies_delivery ? "selected" : ""}`}
                                    onClick={() => toggleApply("applies_delivery")}
                                >
                                    🚗 Delivery
                                </div>
                            </div>
                            {errors.applies && <div className="field-error">{errors.applies}</div>}
                        </div>

                        {/* How it reaches the bill. A tax or service charge is
                            always automatic — one the cashier could forget to
                            tap is not a tax. */}
                        <div className="toggle-row">
                            <span className="toggle-label">
                                Add to every bill automatically
                                <span style={{ display: "block", fontWeight: 400, fontSize: "12px", color: "#94A3B8" }}>
                                    {isTaxLike
                                        ? "Always on for a tax or service charge."
                                        : form.auto_apply
                                            ? "On every matching bill, with nothing for the cashier to do."
                                            : "The cashier taps it on the bill screen when it applies."}
                                </span>
                            </span>
                            <button
                                type="button"
                                className={`toggle-switch ${(isTaxLike || form.auto_apply) ? "on" : ""}`}
                                disabled={isTaxLike}
                                onClick={() => setForm({ ...form, auto_apply: !form.auto_apply })}
                            >
                                <span className="toggle-knob" />
                            </button>
                        </div>

                        <div className="toggle-row">
                            <span className="toggle-label">Charge Status</span>
                            <button
                                type="button"
                                className={`toggle-switch ${form.status === "Active" ? "on" : ""}`}
                                onClick={() => setForm({ ...form, status: form.status === "Active" ? "Inactive" : "Active" })}
                            >
                                <span className="toggle-knob" />
                            </button>
                        </div>

                        {/* Advanced Rules */}
                        <button
                            type="button"
                            className="advanced-toggle"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                        >
                            {showAdvanced ? <FaChevronDown /> : <FaChevronRight />}
                            Advanced Rules
                        </button>

                        {showAdvanced && (
                            <div className="advanced-fields">
                                <div className="charge-form-row">
                                    <div className="charge-form-group">
                                        <label>Minimum Bill Amount</label>
                                        <div className="amount-input-wrap">
                                            <span className="currency-prefix">₹</span>
                                            <input type="number" min="0" placeholder="0" />
                                        </div>
                                    </div>
                                    <div className="charge-form-group">
                                        <label>Maximum Charge</label>
                                        <div className="amount-input-wrap">
                                            <span className="currency-prefix">₹</span>
                                            <input type="number" min="0" placeholder="No limit" />
                                        </div>
                                    </div>
                                </div>
                                <div className="charge-form-row">
                                    <div className="charge-form-group">
                                        <label>Start Time</label>
                                        <input type="text" placeholder="e.g. 10:00" />
                                    </div>
                                    <div className="charge-form-group">
                                        <label>End Time</label>
                                        <input type="text" placeholder="e.g. 22:00" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="charge-modal-footer">
                        <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="save-btn">
                            {isEditMode ? "Update Charge" : "Save Charge"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ChargeModal;
