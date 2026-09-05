import React from "react";
import { FaTrash } from "react-icons/fa";
import useEscapeClose from "../../../hooks/useEscapeClose";

function DeleteChargeModal({ show, charge, onClose, onConfirm }) {

    // Esc closes this modal (src/hooks/useEscapeClose.js).
    useEscapeClose(onClose);

    if (!show) return null;

    return (
        <div className="delete-overlay" onClick={onClose}>
            <div className="delete-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="del-icon">
                    <FaTrash />
                </div>
                <h3>Delete Charge</h3>
                <p>
                    Are you sure you want to delete
                    <strong> {charge?.charge_name}</strong>?
                    This action cannot be undone.
                </p>
                <div className="del-actions">
                    <button className="del-cancel" onClick={onClose}>Cancel</button>
                    <button className="del-confirm" onClick={onConfirm}>Delete</button>
                </div>
            </div>
        </div>
    );
}

export default DeleteChargeModal;
