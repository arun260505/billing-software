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
                            <h3>{order.order_number}</h3>

                            <p>
                                Status:
                                <strong> {order.status}</strong>
                            </p>

                            <p>
                                Items: {Math.round(Number(order.total_items))}
                            </p>

                            <p>
                                Total: Rs.
                                {Number(order.grand_total).toFixed(2)}
                            </p>

                            {onMarkServed && (
                                <button
                                    className="running-served-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMarkServed(order);
                                    }}
                                >
                                    ✓ Mark Served
                                </button>
                            )}

                        </div>
                    ))
                )}

            </div>
        </div>
    );
}

export default RunningOrders;
