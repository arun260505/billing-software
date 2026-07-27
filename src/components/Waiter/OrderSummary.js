import CartItem from "./CartItem";

function OrderSummary({
    cart,
    totalItems,
    subtotal,
    gst,
    grandTotal,
    clearCart,
    placeOrder,
    handleCancelOrder,
    editingOrder,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
}) {
    return (
        <div className="order-summary">

            <div className="summary-header">
                <h2>🧾 Current Order</h2>
            </div>

            <div className="summary-items">

                {cart.length === 0 ? (

                    <div className="empty-cart">
                        <h3>🛒</h3>
                        <p>No items added</p>
                    </div>

                ) : (

                    cart.map((item) => (
                        <CartItem
                            key={item.id}
                            item={item}
                            increaseQuantity={increaseQuantity}
                            decreaseQuantity={decreaseQuantity}
                            removeItem={removeItem}
                        />
                    ))

                )}

            </div>

            <div className="bill-section">

                <div className="bill-row">
                    <span>Total Items</span>
                    <span>{totalItems}</span>
                </div>

                <hr />

                
            </div>

            <div className="summary-buttons">

                <button
                    className="clear-btn"
                    onClick={clearCart}
                >
                    🗑 Clear Cart
                </button>

                <button
                    className="place-btn"
                    onClick={placeOrder}
                >
                    {editingOrder ? "✏️ Update Order" : "✅ Place Order"}
                </button>

                {editingOrder && (
                    <button
                        className="cancel-btn"
                        onClick={handleCancelOrder}
                    >
                        ❌ Cancel Order
                    </button>
                )}

            </div>

        </div>
    );
}

export default OrderSummary;