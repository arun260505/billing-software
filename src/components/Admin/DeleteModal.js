import React from "react";
import ReactDOM from "react-dom";

import "../../styles/Admin/DeleteModal.css";
import useEscapeClose from "../../hooks/useEscapeClose";

function DeleteModal({
    open,
    title = "Delete",
    message = "Are you sure you want to delete this record?",
    onCancel,
    onDelete
}) {

    // Esc closes this modal (src/hooks/useEscapeClose.js).
    useEscapeClose(onCancel);

    if (!open) return null;

    return ReactDOM.createPortal(

        <div className="confirm-delete-overlay">

            <div className="confirm-delete-modal">

                <div className="confirm-delete-header">

                    <h2>{title}</h2>

                </div>

                <div className="confirm-delete-body">

                    <p>{message}</p>

                </div>

                <div className="confirm-delete-footer">

                    <button
                        className="confirm-cancel-btn"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>

                    <button
                        className="confirm-delete-btn"
                        onClick={onDelete}
                    >
                        Delete
                    </button>

                </div>

            </div>

        </div>,

        document.body

    );

}

export default DeleteModal;