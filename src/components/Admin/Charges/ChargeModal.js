import React, { useState, useEffect } from "react";
import { FaTimes, FaChevronDown, FaChevronRight } from "react-icons/fa";

function ChargeModal({ show, onClose, onSave, charge, isEditMode }) {

    const initial = {
        charge_name: "",
        description: "",
        charge_type: "Fixed",
        amount: "",
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
                amount: charge.amount || "",
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

    const validate = () => {
        const e = {};
        if (!form.charge_name.trim()) e.charge_name = "Charge name is required.";
        if (!form.amount || Number(form.amount) <= 0) e.amount = "Enter a valid amount.";
        if (!form.applies_dinein && !form.applies_takeaway && !form.applies_delivery) {
            e.applies = "Select at least one option.";
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validate()) return;
        onSave({
            ...form,
            amount: Number(form.amount)
        });
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
                        {/* Charge Name */}
                        <div className="charge-form-group">
                            <label>Charge Name</label>
                            <input
                                type="text"
                                placeholder="e.g. AC Charge"
                                value={form.charge_name}
                                onChange={(e) => setForm({ ...form, charge_name: e.target.value })}
                            />
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
                                    <option value="Per Item">Per Item</option>
                                    <option value="Per Person">Per Person</option>
                                    <option value="Per Table">Per Table</option>
                                    <option value="Per Hour">Per Hour</option>
                                </select>
                            </div>
                            <div className="charge-form-group">
                                <label>Amount</label>
                                <div className="amount-input-wrap">
                                    <span className="currency-prefix">₹</span>
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

                        {/* Tax & Status Toggles */}
                        <div className="toggle-row">
                            <span className="toggle-label">Apply Tax</span>
                            <button
                                type="button"
                                className={`toggle-switch ${form.apply_tax ? "on" : ""}`}
                                onClick={() => setForm({ ...form, apply_tax: !form.apply_tax })}
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
