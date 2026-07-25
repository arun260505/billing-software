import React from "react";
import "../../styles/Admin/EmployeeSuccessModal.css";

function EmployeeSuccessModal({ show, credentials, onClose }) {

    if (!show) return null;

    const copyCredentials = () => {

        const text = `Username: ${credentials.username}
Password: ${credentials.password}`;

        navigator.clipboard.writeText(text);

        alert("Credentials copied successfully.");

    };

    return (

        <div className="success-modal-overlay">

            <div className="success-modal">

                <h2>✅ Employee Created</h2>

                <div className="success-content">

                    <label>Employee</label>
                    <div>{credentials.full_name}</div>

                    <label>Username</label>
                    <div>{credentials.username}</div>

                    <label>Temporary Password</label>
                    <div>{credentials.password}</div>

                </div>

                <div className="success-buttons">

                    <button
                        className="copy-btn"
                        onClick={copyCredentials}
                    >
                        Copy Credentials
                    </button>

                    <button
                        className="ok-btn"
                        onClick={onClose}
                    >
                        OK
                    </button>

                </div>

            </div>

        </div>

    );

}

export default EmployeeSuccessModal;