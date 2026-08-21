import React from "react";
import { FaEdit, FaTrash } from "react-icons/fa";

function CategoryTable({
    categories,
    onEdit,
    onDelete
}) {

    const formatTiming = (startTime, endTime) => {
        if (!startTime || !endTime) {
            return "All Day";
        }

        return `${startTime.slice(0, 5)} - ${endTime.slice(0, 5)}`;
    };

    return (

        <div className="category-table-container">

            <table className="category-table">

                <thead>

                    <tr>
                        <th>#</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Display Order</th>
                        <th>Timing</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>

                </thead>

                <tbody>

                    {categories.length === 0 ? (

                        <tr>

                            <td
                                colSpan="7"
                                className="empty-table"
                            >

                                No categories found.

                            </td>

                        </tr>

                    ) : (

                        categories.map((category, index) => (

                            <tr key={category.id}>

                                <td>{index + 1}</td>

                                <td>{category.category_name}</td>

                                <td>
                                    {category.description || "-"}
                                </td>

                                <td>
                                    {category.display_order}
                                </td>

                                <td>
                                    {formatTiming(
                                        category.start_time,
                                        category.end_time
                                    )}
                                </td>

                                <td>

                                    <span
                                        className={
                                            category.status === "Active"
                                                ? "status-badge active"
                                                : "status-badge inactive"
                                        }
                                    >

                                        {category.status}

                                    </span>

                                </td>

                                <td>

                                    <button
                                        className="table-btn edit-btn"
                                        onClick={() => onEdit(category)}
                                    >

                                        <FaEdit />

                                    </button>

                                    <button
                                        className="table-btn delete-btn"
                                        onClick={() => onDelete(category)}
                                    >

                                        <FaTrash />

                                    </button>

                                </td>

                            </tr>

                        ))

                    )}

                </tbody>

            </table>

        </div>

    );

}

export default CategoryTable;
