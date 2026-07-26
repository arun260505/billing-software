import React from "react";

import TableCard from "./TableCard";

const TableGrid = ({ tables }) => {

    if (!tables.length) {

        return (

            <div className="no-tables">

                <h3>No Tables Found</h3>

                <p>Try changing your search or filter.</p>

            </div>

        );

    }

    return (

        <div className="table-grid">

            {tables.map((table) => (

                <TableCard
                    key={table.id}
                    table={table}
                />

            ))}

        </div>

    );

};

export default TableGrid;