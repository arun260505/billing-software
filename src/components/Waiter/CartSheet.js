import CartItem from "./CartItem";

// Bottom sheet listing the NEW items about to be sent. Opened from the bottom
// bar so the waiter reviews everything right before sending — and so adding
// items from the menu never pushes the menu around (the cart lives here, not
// inline above the menu).
function CartSheet({ tableLabel, items, editing, busy, increaseQuantity, decreaseQuantity, removeItem, setNote, onClear, onSend, onCancelOrder, onClose }) {

    const total = items.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
    const count = items.reduce((s, i) => s + Number(i.quantity), 0);

    return (
        <div className="cs-overlay" onClick={onClose}>
            <div className="cs-sheet" onClick={(e) => e.stopPropagation()}>

                <div className="cs-head">
                    <div>
                        <h3>Your Order · {tableLabel}</h3>
                        <span className="cs-sub">{count} item{count === 1 ? "" : "s"} · review before sending</span>
                    </div>
                    <button className="cs-close" onClick={onClose} aria-label="Close">✕</button>
                </div>

                <div className="cs-body">
                    {items.length === 0 ? (
                        <p className="cs-empty">No items added yet.</p>
                    ) : (
                        items.map((item) => (
                            <CartItem
                                key={item.lineId}
                                item={item}
                                increaseQuantity={increaseQuantity}
                                decreaseQuantity={decreaseQuantity}
                                removeItem={removeItem}
                                setNote={setNote}
                            />
                        ))
                    )}
                </div>

                <div className="cs-footer">
                    <div className="cs-total"><span>Total</span><span>₹{total.toFixed(0)}</span></div>
                    <div className="cs-actions">
                        <button className="cs-addmore" onClick={onClose}>+ Add more</button>
                        <button className="cs-send" onClick={onSend} disabled={items.length === 0 || busy}>
                            {busy ? "Sending..." : editing ? "Update Order" : "Send to Kitchen"}
                        </button>
                    </div>
                    {editing
                        ? <button className="cs-cancel" onClick={onCancelOrder}>✕ Cancel Order</button>
                        : (items.length > 0 && <button className="cs-clear" onClick={onClear}>Clear all</button>)}
                </div>

            </div>
        </div>
    );
}

export default CartSheet;
