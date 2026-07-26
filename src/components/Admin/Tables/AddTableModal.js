import React, { useState } from "react";

import "../../../styles/Admin/Tables/Modal.css";

const AddTableModal = ({ isOpen, onClose, onSave }) => {

    const [formData, setFormData] = useState({
        table_name: "",
        capacity: "",
        location: "",
        status: "Available"
    });

    if (!isOpen) return null;

    const handleChange = (e) => {

        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });

    };

    const handleSubmit = (e) => {

        e.preventDefault();

        onSave(formData);

        setFormData({
            table_name: "",
            capacity: "",
            location: "",
            status: "Available"
        });

    };

    return (

        <div className="modal-overlay">

            <div className="add-table-modal">

                <h2>Add New Table</h2>

                <form onSubmit={handleSubmit}>

                    <div className="form-group">

                        <label>Table Name</label>

                        <input
                            type="text"
                            name="table_name"
                            value={formData.table_name}
                            onChange={handleChange}
                            required
                        />

                    </div>

                    <div className="form-group">

                        <label>Capacity</label>

                        <input
                            type="number"
                            name="capacity"
                            value={formData.capacity}
                            onChange={handleChange}
                            required
                        />

                    </div>

                    <div className="form-group">

                        <label>Location</label>

                        <input
                            type="text"
                            name="location"
                            value={formData.location}
                            onChange={handleChange}
                            required
                        />

                    </div>

                    <div className="form-group">

                        <label>Status</label>

                        <select
                            name="status"
                            value={formData.status}
                            onChange={handleChange}
                        >
                            <option>Available</option>
                            <option>Occupied</option>
                            <option>Reserved</option>
                            <option>Billing</option>
                            <option>Cleaning</option>
                        </select>

                    </div>

                    <div className="modal-actions">

                        <button
                            type="button"
                            className="btn-cancel"
                            onClick={onClose}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="btn-save"
                        >
                            Save Table
                        </button>

                    </div>

                </form>

            </div>

        </div>

    );

};

export default AddTableModal;