// onMarkServed is optional — only the waiter passes it, which shows a
// "Mark Served" button on each running order (kitchen is display-only).
function RunningOrders({
    runningOrders,
    closeOrders,
    openOrder,
    onMarkServed,
}) {
    return (
        <div className="running-orders-overlay">
            <div className="running-orders">

                <div className="running-header">
                    <h2>Running Orders</h2>

                    <button onClick={closeOrders}>
                        X
                    </button>
                </div>

                <div className="running-orders-list">
                    {runningOrders.length === 0 ? (
                        <p>No Running Orders</p>
                    ) : (
                        runningOrders.map((order) => (
                            <div
                                className="running-card"
                                key={order.id}
                                onClick={() => openOrder(order)}
                                style={{ cursor: "pointer" }}
                            >
                                <div className="running-card-header">
                                    <h3>{order.order_number}</h3>
                                    {order.table_name && (
                                        <span className="running-table-badge">Table {order.table_name}</span>
                                    )}
                                </div>

                                <div className="running-card-body">
                                    <p>
                                        <span>Status</span>
                                        <strong className={`status-${order.status.toLowerCase()}`}>{order.status}</strong>
                                    </p>
                                    <p>
                                        <span>Items</span>
                                        <strong>{Math.round(Number(order.total_items))}</strong>
                                    </p>
                                    <p>
                                        <span>Total</span>
                                        <strong>Rs. {Number(order.grand_total).toFixed(2)}</strong>
                                    </p>
                                </div>

                                {onMarkServed && (
                                    <button
                                        className="running-served-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onMarkServed(order);
                                        }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        Mark Served
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>

            </div>
        </div>
    );
}

export default RunningOrders;
