import React from "react";
import "../../../styles/Admin/Tables/TableIllustration.css";

const Chair = ({ className, statusClass }) => (
    <div className={`chair ${className} ${statusClass}`}>
        <div className="chair-seat"></div>
    </div>
);

const TableIllustration = ({ capacity = 4, status = "Available" }) => {

    const statusClass = status.toLowerCase();

    const layouts = {
        2: ["top", "bottom"],
        4: ["top", "right", "bottom", "left"],
        6: ["top","top-right","bottom-right","bottom","bottom-left","top-left"],
        8: ["top","top-right","right","bottom-right","bottom","bottom-left","left","top-left"]
    };

    const chairs = layouts[capacity] || layouts[4];

    return (
        <div className="table-layout">

            {chairs.map((chair, index) => (
                <Chair
                    key={index}
                    className={chair}
                    statusClass={statusClass}
                />
            ))}

            <div className={`restaurant-table ${statusClass}`}>
                <div className="table-center"></div>
            </div>

        </div>
    );
};

export default TableIllustration;