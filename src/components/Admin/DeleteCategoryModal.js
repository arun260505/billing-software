import React from "react";
import "../../styles/Admin/DeleteCategoryModal.css";

function DeleteCategoryModal({
    show,
    category,
    onClose,
    onConfirm
}) {

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