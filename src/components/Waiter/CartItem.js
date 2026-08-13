function CartItem({
    item,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
}) {
    const quantityIncreased = !item.isNew && item.originalQuantity !== undefined && item.quantity > item.originalQuantity;
    const addedCount = quantityIncreased ? item.quantity - item.originalQuantity : 0;

    return (
        <div className={`cart-item ${item.isNew ? "new-item" : ""}`}>

            <div className="cart-top">

                <h4>
                    {item.item_name || item.name}
                    {item.isNew && <span className="new-badge">🆕 NEW</span>}
                    {quantityIncreased && <span className="added-badge">🆕 +{addedCount} Added</span>}
                </h4>

                <button
                    className="delete-item"
                    onClick={() => removeItem(item.id)}
                >
                    🗑
                </button>

            </div>

            <p className="item-total">

                ₹{item.price} × {item.quantity} = ₹
                {item.price * item.quantity}

            </p>

            <div className="qty-controls">

                <button
                    onClick={() =>
                        decreaseQuantity(item.id)
                    }
                >
                    −
                </button>

                <span>{item.quantity}</span>

                <button
                    onClick={() =>
                        increaseQuantity(item.id)
                    }
                >
                    +
                </button>

            </div>

        </div>
    );
}

export default CartItem;
