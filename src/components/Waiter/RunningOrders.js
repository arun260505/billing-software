function RunningOrders({
    runningOrders,
    closeOrders,
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
                            key={order.orderNumber}
                        >
                            <h3>{order.orderNumber}</h3>
                            <p>
                                Status:{" "}
                                <strong>{order.status}</strong>
                            </p>
                            <p>Items: {order.totalItems}</p>
                            <p>
                                Total: Rs.
                                {order.grandTotal.toFixed(2)}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default RunningOrders;
