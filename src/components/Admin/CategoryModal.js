import React, { useEffect, useState } from "react";

import "../../styles/Admin/CategoryModal.css";

function CategoryModal({
    show,
    onClose,
    onSave,
    category = null,
    isEditMode = false
}) {

    const initialState = {
        category_name: "",
        description: "",
        display_order: "",
        status: "Active"
    };

    const [form, setForm] = useState(initialState);

    useEffect(() => {

        if (isEditMode && category) {

            setForm({
                category_name: category.category_name || "",
                description: category.description || "",
                display_order: category.display_order || "",
                status: category.status || "Active"
            });

        } else {

            setForm(initialState);

        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category, isEditMode]);

    const handleChange = (e) => {

        setForm({
            ...form,
            [e.target.name]: e.target.value
        });

    };

    const handleSubmit = (e) => {

        e.preventDefault();

        onSave(form);

    };

    if (!show) return null;

    return (

        <div className="modal-overlay">

            <div className="category-modal">

                <div className="modal-header">

                    <h2>

                        {isEditMode
                            ? "Edit Category"
                            : "Add Category"}

                    </h2>

                    <button
                        className="close-btn"
                        onClick={onClose}
                    >
                        ×
                    </button>

                </div>

                <form onSubmit={handleSubmit}>

                    <div className="form-group">

                        <label>Category Name</label>

                        <input
                            type="text"
                            name="category_name"
                            value={form.category_name}
                            onChange={handleChange}
                            required
                        />

                    </div>

                    <div className="form-group">

                        <label>Description</label>

                        <textarea
                            name="description"
                            value={form.description}
                            onChange={handleChange}
                            rows="3"
                        />

                    </div>

                    <div className="form-row">

                        <div className="form-group">

                            <label>Display Order</label>

                            <input
                                type="number"
                                name="display_order"
                                value={form.display_order}
                                onChange={handleChange}
                            />

                        </div>

                        <div className="form-group">

                            <label>Status</label>

                            <select
                                name="status"
                                value={form.status}
                                onChange={handleChange}
                            >

                                <option value="Active">
                                    Active
                                </option>

                                <option value="Inactive">
                                    Inactive
                                </option>

                            </select>

                        </div>

                    </div>

                    <div className="modal-actions">

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
                            {isEditMode
                                ? "Update Category"
                                : "Save Category"}
                        </button>

                    </div>

                </form>

            </div>

        </div>

    );

}

export default CategoryModal;