import TableCard from "./TableCard";

function TableGrid({ tables, onSelectTable }) {
    return (
        <div className="table-grid">
            {tables.map((table) => (
                <TableCard
                    key={table.id}
                    table={table}
                    onClick={() => onSelectTable(table)}
                />
            ))}
        </div>
    );
}

export default TableGrid;
