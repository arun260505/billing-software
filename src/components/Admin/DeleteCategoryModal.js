import React from "react";
import "../../styles/Admin/DeleteCategoryModal.css";
import useEscapeClose from "../../hooks/useEscapeClose";

function DeleteCategoryModal({
    show,
    category,
    onClose,
    onConfirm
}) {

    // Esc closes this modal (src/hooks/useEscapeClose.js).
    useEscapeClose(onClose);

    if (!show) return null;

    return (
        <div className="delete-modal-overlay">

            <div className="delete-modal">

                <div className="delete-icon">
                    🗑️
                </div>

                <h2>Delete Category</h2>

                <p>

                    Are you sure you want to delete

                    <strong>
                        {" "}
                        {category?.category_name}
                    </strong>

                    ?

                </p>

                <div className="delete-actions">

                    <button
                        className="cancel-delete-btn"
                        onClick={onClose}
                    >
                        Cancel
                    </button>

                    <button
                        className="confirm-delete-btn"
                        onClick={onConfirm}
                    >
                        Delete
                    </button>

                </div>

            </div>

        </div>
    );

}

export default DeleteCategoryModal;