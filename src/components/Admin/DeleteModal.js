import React from "react";
import "../../styles/Admin/DeleteModal.css";

function DeleteModal({
    open,
    title = "Delete",
    message = "Are you sure you want to delete this record?",
    onCancel,
    onDelete
}) {

    if (!open) return null;

    return (

        <div className="delete-overlay">

            <div className="delete-modal">

                <div className="delete-header">

                    <h2>{title}</h2>

                </div>

                <div className="delete-body">

                    <p>{message}</p>

                </div>

                <div className="delete-footer">

                    <button
                        className="cancel-btn"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>

                    <button
                        className="delete-btn"
                        onClick={onDelete}
                    >
                        Delete
                    </button>

                </div>

            </div>

        </div>

    );

}

export default DeleteModal;