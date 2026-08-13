function TableCard({ table, onClick }) {
    return (
        <div
            className={`table-card ${
                table.status === "FREE"
                    ? "free"
                    : "occupied"
            }`}
            onClick={onClick}
        >
            <h3>🍽 Table {table.table_number}</h3>

            <p>Seats : {table.capacity}</p>

            <h4>{table.status}</h4>
        </div>
    );
}

export default TableCard;
