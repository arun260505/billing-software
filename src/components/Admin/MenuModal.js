import React, { useEffect, useState } from "react";
import "../../styles/Admin/MenuModal.css";
import useEscapeClose from "../../hooks/useEscapeClose";

function MenuModal({
    open,
    onClose,
    onSave,
    categories,
    editItem,
    menuService
}) {

    // Esc closes this modal (src/hooks/useEscapeClose.js).
    useEscapeClose(onClose);

    const initialForm = {
        category_id: "",
        item_name: "",
        item_code: "",
        price: "",
        gst: 5,
        kitchen_section: "Kitchen",
        food_type: "Veg",
        description: "",
        preparation_time: "",
        display_order: 1,
        available: 1,
        is_today_special: 0,
        is_best_seller: 0,
        is_new_item: 0,
        is_seasonal: 0
    };

    const [formData, setFormData] = useState(initialForm);

    useEffect(() => {

        if (editItem) {
            setFormData({
                ...initialForm,
                ...editItem
            });
        } else {
            setFormData(initialForm);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editItem]);

    const handleChange = (e) => {

        const { name, value, type, checked } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]:
                type === "checkbox"
                    ? (checked ? 1 : 0)
                    : value
        }));

    };

    const handleSubmit = async (e) => {

        e.preventDefault();

        if (!formData.category_id) {
            alert("Please select a category.");
            return;
        }

        if (!formData.item_name.trim()) {
            alert("Item name is required.");
            return;
        }

        // `!formData.price` was the whole check, so it only caught an empty box:
        // a negative price, a price of zero and anything non-numeric all sailed
        // through onto real bills. type="number" doesn't help — the browser
        // hands over an empty string for junk and happily accepts "-50".
        const price = Number(formData.price);

        if (formData.price === "" || formData.price === null) {
            alert("Price is required.");
            return;
        }
        if (!Number.isFinite(price)) {
            alert("Price must be a number.");
            return;
        }
        if (price <= 0) {
            alert("Price must be greater than zero.");
            return;
        }
        if (price > 1000000) {
            alert("That price looks wrong. Please check it.");
            return;
        }
        // Money is two decimals. 149.999 would be stored as 150.00 by the
        // DECIMAL(10,2) column and the admin would never know it was changed.
        if (Math.round(price * 100) !== price * 100) {
            alert("Price can have at most 2 decimal places (e.g. 149.50).");
            return;
        }

        try {

            if (editItem) {

                await menuService.updateMenuItem(
                    editItem.id,
                    formData
                );

            } else {

                await menuService.addMenuItem(formData);

            }

            onSave();
            onClose();

        } catch (err) {

            console.error(err);
            alert("Unable to save menu item.");

        }

    };

    if (!open) return null;

    return (

        <div className="modal-overlay">

            <div className="menu-modal">

                <div className="modal-header">

                    <h2>

                        {editItem
                            ? "Edit Menu Item"
                            : "Add Menu Item"}

                    </h2>

                </div>

                <form onSubmit={handleSubmit}>

                    <div className="modal-grid">

                        <div>

                            <label>Category *</label>

                            <select
                                name="category_id"
                                value={formData.category_id}
                                onChange={handleChange}
                            >

                                <option value="">
                                    Select Category
                                </option>

                                {categories.map(cat => (

                                    <option
                                        key={cat.id}
                                        value={cat.id}
                                    >
                                        {cat.category_name}
                                    </option>

                                ))}

                            </select>

                        </div>

                        <div>

                            <label>Item Name *</label>

                            <input
                                type="text"
                                name="item_name"
                                value={formData.item_name}
                                onChange={handleChange}
                            />

                        </div>

                        <div>

                            <label>Item Code</label>

                            <input
                                type="text"
                                name="item_code"
                                value={formData.item_code}
                                onChange={handleChange}
                            />

                        </div>

                        <div>

                            <label>Price *</label>

                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max="1000000"
                                name="price"
                                value={formData.price}
                                onChange={handleChange}
                            />

                        </div>

                        <div>

                            <label>GST</label>

                            <input
                                type="number"
                                name="gst"
                                value={formData.gst}
                                onChange={handleChange}
                            />

                        </div>

                        <div>

                            <label>Kitchen Section</label>

                            {/* This column is enum('Kitchen','Bar','Bakery').
                                It was a free-text box, so a blank field — the
                                default — or any other wording was rejected by
                                MySQL, and saving a menu item failed with a
                                generic "Something went wrong". */}
                            <select
                                name="kitchen_section"
                                value={formData.kitchen_section || "Kitchen"}
                                onChange={handleChange}
                            >
                                <option value="Kitchen">Kitchen</option>
                                <option value="Bar">Bar</option>
                                <option value="Bakery">Bakery</option>
                            </select>

                        </div>

                        <div>

                            <label>Food Type</label>

                            <select
                                name="food_type"
                                value={formData.food_type}
                                onChange={handleChange}
                            >
                                <option value="Veg">Veg</option>
                                <option value="Non Veg">Non Veg</option>
                                <option value="Egg">Egg</option>
                            </select>

                        </div>

                        <div>

                            <label>Preparation Time (Minutes)</label>

                            <input
                                type="number"
                                name="preparation_time"
                                value={formData.preparation_time}
                                onChange={handleChange}
                            />

                        </div>

                        <div>

                            <label>Display Order</label>

                            <input
                                type="number"
                                name="display_order"
                                value={formData.display_order}
                                onChange={handleChange}
                            />

                        </div>

                    </div>

                    <div className="full-width">

                        <label>Description</label>

                        <textarea
                            rows="3"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                        />

                    </div>

                    <div className="checkbox-group">

                        <label>
                            <input
                                type="checkbox"
                                name="available"
                                checked={formData.available === 1}
                                onChange={handleChange}
                            />
                            Available
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                name="is_today_special"
                                checked={formData.is_today_special === 1}
                                onChange={handleChange}
                            />
                            Today's Special
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                name="is_best_seller"
                                checked={formData.is_best_seller === 1}
                                onChange={handleChange}
                            />
                            Best Seller
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                name="is_new_item"
                                checked={formData.is_new_item === 1}
                                onChange={handleChange}
                            />
                            New Item
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                name="is_seasonal"
                                checked={formData.is_seasonal === 1}
                                onChange={handleChange}
                            />
                            Seasonal
                        </label>

                    </div>

                    <div className="modal-footer">

                        <button
                            type="button"
                            className="cancel-btn"
                            onClick={onClose}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="save-btn"
                        >
                            Save
                        </button>

                    </div>

                </form>

            </div>

        </div>

    );

}

export default MenuModal;