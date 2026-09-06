function CartItem({ item, increaseQuantity, decreaseQuantity, removeItem, setNote }) {
    const quantity         = Number(item.quantity) || 0;
    const originalQuantity = Number(item.originalQuantity) || 0;
    const price            = Number(item.price) || 0;
    const lineTotal        = price * quantity;

    const quantityIncreased = !item.isNew && item.originalQuantity !== undefined && quantity > originalQuantity;
    const addedCount        = quantityIncreased ? quantity - originalQuantity : 0;
    const quantityDecreased = !item.isNew && item.originalQuantity !== undefined && quantity < originalQuantity;
    const cancelledCount    = quantityDecreased ? originalQuantity - quantity : 0;

    return (
        <div className={`cart-item-row cir-noimg${item.isNew ? " cir-new" : ""}`}>
            {/* Info */}
            <div className="cir-info">
                <span className="cir-name">{item.item_name || item.name}</span>
                <div className="cir-badges">
                    {item.isNew          && <span className="cir-badge cir-badge-new">NEW</span>}
                    {quantityIncreased   && <span className="cir-badge cir-badge-added">+{addedCount} Added</span>}
                    {quantityDecreased   && <span className="cir-badge cir-badge-cancelled">−{cancelledCount} Cancelled</span>}
                </div>
                <span className="cir-price">₹{price} × {quantity} = <strong>₹{lineTotal}</strong></span>
                {setNote && (
                    <input
                        type="text"
                        className="cir-note"
                        placeholder="🍳 Note (e.g. no ice)…"
                        value={item.note || ""}
                        onChange={(e) => setNote(item.lineId, e.target.value)}
                    />
                )}
            </div>

            {/* Controls */}
            <div className="cir-controls">
                <button className="cir-btn" onClick={() => decreaseQuantity(item.lineId)}>−</button>
                <span className="cir-qty">{quantity}</span>
                <button className="cir-btn" onClick={() => increaseQuantity(item.lineId)}>+</button>
                <button className="cir-remove" onClick={() => removeItem(item.lineId)}>✕</button>
            </div>
        </div>
    );
}

export default CartItem;
