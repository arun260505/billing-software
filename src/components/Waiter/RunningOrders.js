function RunningOrders({
    runningOrders,
    closeOrders,
    openOrder,
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
                                Items: {order.total_items}
                            </p>

                            <p>
                                Total: Rs.
                                {Number(order.grand_total).toFixed(2)}
                            </p>

                        </div>
                    ))
                )}

            </div>
        </div>
    );
}

export default RunningOrders;