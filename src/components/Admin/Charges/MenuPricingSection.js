import React, { useState } from "react";
import { FaCog, FaTimes, FaPlus, FaTrash } from "react-icons/fa";

const sampleMenuItems = [
    { id: 1, name: "Chicken Biryani", dinein: 180, takeaway: 190, delivery: 200, parcel: 10, addons: [{ name: "Extra Egg", price: 30 }, { name: "Extra Cheese", price: 40 }, { name: "Extra Spicy", price: 20 }], status: "Active" },
    { id: 2, name: "Paneer Tikka", dinein: 220, takeaway: 230, delivery: 240, parcel: 10, addons: [{ name: "Extra Paneer", price: 50 }, { name: "Extra Cheese", price: 40 }], status: "Active" },
    { id: 3, name: "Pizza", dinein: 250, takeaway: 270, delivery: 290, parcel: 20, addons: [{ name: "Extra Cheese", price: 40 }, { name: "Stuffed Crust", price: 60 }, { name: "Extra Topping", price: 30 }, { name: "Extra Spicy", price: 20 }], status: "Active" }
];

function MenuPricingSection() {

    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [addons, setAddons] = useState([]);

    const handleEdit = (item) => {
        setEditingItem(item);
        setEditForm({
            dinein: item.dinein,
            takeaway: item.takeaway,
            delivery: item.delivery,
            parcel: item.parcel,
            status: item.status
        });
        setAddons([...item.addons]);
        setShowModal(true);
    };

    const handleSave = () => {
        setShowModal(false);
        setEditingItem(null);
    };

    const addAddon = () => {
        setAddons([...addons, { name: "", price: 0 }]);
    };

    const removeAddon = (idx) => {
        setAddons(addons.filter((_, i) => i !== idx));
    };

    const updateAddon = (idx, field, value) => {
        const updated = [...addons];
        updated[idx] = { ...updated[idx], [field]: value };
        setAddons(updated);
    };

    return (
        <div className="menu-pricing-section">
            <div className="section-header">
                <div>
                    <h3>Menu Item Pricing</h3>
                    <p>Configure different prices and additional charges for individual menu items.</p>
                </div>
                <button className="primary-btn" style={{ fontSize: 13, padding: "8px 16px" }}>
                    <FaCog /> Manage Menu Pricing
                </button>
            </div>

            <div className="pricing-table-card">
                <table className="pricing-table">
                    <thead>
                        <tr>
                            <th>Menu Item</th>
                            <th>Dine-in</th>
                            <th>Takeaway</th>
                            <th>Delivery</th>
                            <th>Parcel</th>
                            <th>Add-ons</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sampleMenuItems.map((item) => (
                            <tr key={item.id}>
                                <td className="item-name">{item.name}</td>
                                <td>₹{item.dinein}</td>
                                <td>₹{item.takeaway}</td>
                                <td>₹{item.delivery}</td>
                                <td>₹{item.parcel}</td>
                                <td>
                                    <span className="addon-count">
                                        {item.addons.length} Add-on{item.addons.length !== 1 ? "s" : ""}
                                    </span>
                                </td>
                                <td>
                                    <span className={`status-dot ${item.status === "Active" ? "active" : "inactive"}`}>
                                        <span className="dot"></span>
                                        {item.status}
                                    </span>
                                </td>
                                <td>
                                    <button className="edit-pricing-btn" onClick={() => handleEdit(item)}>
                                        Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pricing Edit Modal */}
            {showModal && editingItem && (
                <div className="pricing-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="pricing-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="pricing-modal-header">
                            <h2>Edit Menu Pricing</h2>
                            <button className="close-btn" onClick={() => setShowModal(false)}><FaTimes /></button>
                        </div>

                        <div className="pricing-modal-body">
                            <div className="charge-form-group">
                                <label>Menu Item</label>
                                <input type="text" value={editingItem.name} readOnly style={{ background: "#F1F5F9" }} />
                            </div>

                            <div className="charge-form-row">
                                <div className="charge-form-group">
                                    <label>Dine-in Price</label>
                                    <div className="amount-input-wrap">
                                        <span className="currency-prefix">₹</span>
                                        <input
                                            type="number"
                                            value={editForm.dinein}
                                            onChange={(e) => setEditForm({ ...editForm, dinein: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="charge-form-group">
                                    <label>Takeaway Price</label>
                                    <div className="amount-input-wrap">
                                        <span className="currency-prefix">₹</span>
                                        <input
                                            type="number"
                                            value={editForm.takeaway}
                                            onChange={(e) => setEditForm({ ...editForm, takeaway: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="charge-form-row">
                                <div className="charge-form-group">
                                    <label>Delivery Price</label>
                                    <div className="amount-input-wrap">
                                        <span className="currency-prefix">₹</span>
                                        <input
                                            type="number"
                                            value={editForm.delivery}
                                            onChange={(e) => setEditForm({ ...editForm, delivery: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="charge-form-group">
                                    <label>Parcel Charge</label>
                                    <div className="amount-input-wrap">
                                        <span className="currency-prefix">₹</span>
                                        <input
                                            type="number"
                                            value={editForm.parcel}
                                            onChange={(e) => setEditForm({ ...editForm, parcel: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="charge-form-group">
                                <label>Add-ons</label>
                                {addons.map((addon, idx) => (
                                    <div className="addon-row" key={idx}>
                                        <input
                                            type="text"
                                            placeholder="Add-on name"
                                            value={addon.name}
                                            onChange={(e) => updateAddon(idx, "name", e.target.value)}
                                        />
                                        <div className="amount-input-wrap addon-price">
                                            <span className="currency-prefix">₹</span>
                                            <input
                                                type="number"
                                                value={addon.price}
                                                onChange={(e) => updateAddon(idx, "price", Number(e.target.value))}
                                            />
                                        </div>
                                        <button className="remove-addon" onClick={() => removeAddon(idx)}>
                                            <FaTrash />
                                        </button>
                                    </div>
                                ))}
                                <button className="add-addon-btn" onClick={addAddon}>
                                    <FaPlus /> Add Add-on
                                </button>
                            </div>

                            <div className="toggle-row">
                                <span className="toggle-label">Availability</span>
                                <button
                                    type="button"
                                    className={`toggle-switch ${editForm.status === "Active" ? "on" : ""}`}
                                    onClick={() => setEditForm({ ...editForm, status: editForm.status === "Active" ? "Inactive" : "Active" })}
                                >
                                    <span className="toggle-knob" />
                                </button>
                            </div>
                        </div>

                        <div className="charge-modal-footer">
                            <button className="cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="save-btn" onClick={handleSave}>Save Pricing</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MenuPricingSection;
