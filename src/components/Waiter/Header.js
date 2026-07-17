function Header({
    orderNumber,
    waiterName,
    currentDate,
    currentTime,
    newOrder,
    openRunningOrders,
}) {
    return (
        <div className="dashboard-header">

            <div className="header-info">

                <h1>Waiter Dashboard</h1>

                <p>
                    <strong>Order No:</strong> {orderNumber}
                </p>

                <p>
                    <strong>Waiter:</strong> {waiterName}
                </p>

                <p>
                    <strong>Date:</strong> {currentDate}
                </p>

                <p>
                    <strong>Time:</strong> {currentTime}
                </p>

            </div>

            <div className="header-buttons">

                <button
                    className="new-order-btn"
                    onClick={newOrder}
                >
                    + New Order
                </button>

                <button
                    onClick={openRunningOrders}
                >
                    Running Orders
                </button>

                <button>
                    Completed Orders
                </button>

            </div>

        </div>
    );
}

export default Header;