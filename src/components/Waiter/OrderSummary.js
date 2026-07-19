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

                <div className="bill-row">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                </div>

                <div className="bill-row">
                    <span>GST (5%)</span>
                    <span>₹{gst.toFixed(2)}</span>
                </div>

                <hr />

                <div className="grand-total">

                    <span>Grand Total</span>

                    <span>
                        ₹{grandTotal.toFixed(2)}
                    </span>

                </div>

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