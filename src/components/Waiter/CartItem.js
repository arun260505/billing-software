function CartItem({
    item,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
}) {
    return (
        <div className="cart-item">

            <div className="cart-top">

                <h4>{item.item_name || item.name}</h4>

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
