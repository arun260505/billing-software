// Clean mobile menu card: veg / non-veg dot, name, description, price.
// Tapping ANYWHERE on the card adds one to the order (and bumps the quantity);
// the "+" button and the − qty + stepper still work on their own — they stop the
// click from bubbling so a tap on a button doesn't count twice.
// onToggleAvailability is optional — only the cashier passes it, which shows the
// "Mark Available / Unavailable" toggle on each card.
// tapToAddOnly (a per-restaurant setting): no +/− stepper on the card — tap the
// card to add, and change quantity in the cart on the right. A read-only ×N badge
// shows how many are already in the cart.
function MenuCard({ item, addToCart, removeOneFromCart, quantity = 0, onToggleAvailability, tapToAddOnly = false }) {

    const isUnavailable = Number(item.available_quantity) === 0;

    // Veg / Egg / NonVeg → the little square-dot indicator colour.
    const ft = String(item.food_type || "Veg").toLowerCase();
    const foodClass = ft.includes("non") ? "nonveg" : ft.includes("egg") ? "egg" : "veg";

    // A tap on the card body adds the item (only when it's available).
    const handleCardAdd = () => { if (!isUnavailable) addToCart(item); };

    return (
        <div
            className={`menu-card food-${foodClass}${isUnavailable ? " out-of-stock-card" : " is-tappable"}`}
            onClick={handleCardAdd}
            role="button"
        >
            <span className={`veg-dot veg-dot-${foodClass}`} aria-hidden="true">
                <i />
            </span>

            <div className="menu-details">
                <h3 className="menu-name">{item.item_name}</h3>
                {item.description && <p className="menu-desc">{item.description}</p>}

                <div className="menu-card-bottom">
                    {/* Two decimals: a 99.50 item was priced "₹99" on the till,
                        so the menu and the bill disagreed before a single item
                        was even added. */}
                    <span className="menu-price">₹{Number(item.price).toFixed(2)}</span>

                    {isUnavailable ? (
                        <span className="menu-unavailable-tag">Unavailable</span>
                    ) : tapToAddOnly ? (
                        // Tap-to-add: nothing on the card at all — no +/−, no qty badge.
                        // Tap the card to add; the quantity lives only in the cart.
                        null
                    ) : quantity > 0 ? (
                        <div className="mc-stepper">
                            <button className="mc-step" onClick={(e) => { e.stopPropagation(); removeOneFromCart && removeOneFromCart(item); }}>−</button>
                            <span className="mc-qty">{quantity}</span>
                            <button className="mc-step mc-step-add" onClick={(e) => { e.stopPropagation(); addToCart(item); }}>+</button>
                        </div>
                    ) : (
                        <button className="mc-add" onClick={(e) => { e.stopPropagation(); addToCart(item); }} title="Add to order">+</button>
                    )}
                </div>
            </div>

            {/* Cashier-only availability toggle */}
            {onToggleAvailability && (
                <button
                    className={`avail-toggle${isUnavailable ? " is-off" : " is-on"}`}
                    onClick={(e) => { e.stopPropagation(); onToggleAvailability(item); }}
                    title={isUnavailable ? "Mark available" : "Mark unavailable"}
                >
                    {isUnavailable ? "✓ Mark Available" : "✕ Mark Unavailable"}
                </button>
            )}
        </div>
    );
}

export default MenuCard;
