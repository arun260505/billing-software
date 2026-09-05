import React, { useEffect, useState } from "react";
import useEscapeClose from "../../hooks/useEscapeClose";

function EmployeeModal({ show, onClose, onSave }) {

    // Esc closes this modal (src/hooks/useEscapeClose.js).
    useEscapeClose(onClose);

    const [form, setForm] = useState({
        full_name: "",
        mobile: "",
        email: "",
        role: "cashier",
        status: "Active"
    });

    const [generatedUsername, setGeneratedUsername] = useState("");
    const [generatedPassword, setGeneratedPassword] = useState("");

    const handleChange = (e) => {

        const { name, value } = e.target;

        setForm(prev => ({
            ...prev,
            [name]: value
        }));

    };

    const generateUsername = () => {

        // Username suffix = the logged-in admin's restaurant name slug
        // (e.g. "NPK Kitchen" -> "npkkitchen"), matching the backend.
        const loggedUser = JSON.parse(localStorage.getItem("user") || "{}");
        const restaurant =
            (loggedUser.restaurant_name || "restaurant")
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "") || "restaurant";

        const cleanName = form.full_name
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "");

        if (!cleanName) {

            setGeneratedUsername("");

            return;

        }

        setGeneratedUsername(
            `${cleanName}_${form.role}@${restaurant}`
        );

    };

    const generatePassword = () => {

        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        let password = "";

        for (let i = 0; i < 8; i++) {

            password += chars.charAt(
                Math.floor(Math.random() * chars.length)
            );

        }

        setGeneratedPassword(password);

    };

    const copyCredentials = () => {

        navigator.clipboard.writeText(
            `Username: ${generatedUsername}\nPassword: ${generatedPassword}`
        );

        alert("Credentials copied successfully!");

    };

    useEffect(() => {

        generateUsername();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.full_name, form.role]);

    useEffect(() => {

        if (show) {

            generatePassword();

        }

    }, [show]);

    const handleSubmit = (e) => {

        e.preventDefault();

        onSave({

            ...form,

            username: generatedUsername,

            password: generatedPassword

        });

    };

    if (!show) return null;

    return (

        <div className="employee-modal-overlay">

            <div className="employee-modal">

                <div className="modal-header">

                    <h2>Add Employee</h2>

                    <button
                        type="button"
                        className="close-btn"
                        onClick={onClose}
                    >
                        ✕
                    </button>

                </div>

                <form onSubmit={handleSubmit}>

                    <div className="employee-form-grid">

                        <div className="form-group">

                            <label>Full Name *</label>

                            <input
                                type="text"
                                name="full_name"
                                placeholder="Enter Full Name"
                                value={form.full_name}
                                onChange={handleChange}
                                required
                            />

                        </div>

                        <div className="form-group">

                            <label>Mobile Number</label>

                            <input
                                type="text"
                                name="mobile"
                                placeholder="Enter Mobile Number"
                                value={form.mobile}
                                onChange={handleChange}
                            />

                        </div>

                        <div className="form-group">

                            <label>Email</label>

                            <input
                                type="email"
                                name="email"
                                placeholder="Enter Email"
                                value={form.email}
                                onChange={handleChange}
                            />

                        </div>

                        <div className="form-group">

                            <label>Role</label>

                            <select
                                name="role"
                                value={form.role}
                                onChange={handleChange}
                            >
                                <option value="admin">Admin</option>
                                <option value="cashier">Cashier</option>
                                <option value="waiter">Waiter</option>
                                <option value="kitchen">Kitchen</option>
                            </select>

                        </div>

                        <div className="form-group full-width">

                            <label>Status</label>

                            <select
                                name="status"
                                value={form.status}
                                onChange={handleChange}
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>

                        </div>

                    </div>

                    <div className="generated-box">

                        <h3>Generated Login Credentials</h3>

                        <div className="credentials-grid">

                            <div>

                                <label>Username</label>

                                <input
                                    type="text"
                                    value={generatedUsername}
                                    readOnly
                                />

                            </div>

                            <div>

                                <label>Password</label>

                                <input
                                    type="text"
                                    value={generatedPassword}
                                    readOnly
                                />

                            </div>

                        </div>

                        <div className="credentials-actions">

                            <button
                                type="button"
                                className="generate-btn"
                                onClick={generatePassword}
                            >
                                🔄 Generate Again
                            </button>

                            <button
                                type="button"
                                className="copy-btn"
                                onClick={copyCredentials}
                            >
                                📋 Copy Credentials
                            </button>

                        </div>

                    </div>

                    <div className="modal-buttons">

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
                            Create Employee
                        </button>

                    </div>

                </form>

            </div>

        </div>

    );

}

export default EmployeeModal;