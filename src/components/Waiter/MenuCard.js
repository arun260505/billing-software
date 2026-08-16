// Clean mobile menu card: veg / non-veg dot, name, description, price.
// Tapping the card adds the item to the cart (no separate "+" button).
// onToggleAvailability is optional — only the cashier passes it, which shows the
// "Mark Available / Unavailable" toggle on each card.
function MenuCard({ item, addToCart, onToggleAvailability }) {

    const isUnavailable = Number(item.available_quantity) === 0;

    // Veg / Egg / NonVeg → the little square-dot indicator colour.
    const ft = String(item.food_type || "Veg").toLowerCase();
    const foodClass = ft.includes("non") ? "nonveg" : ft.includes("egg") ? "egg" : "veg";

    const handleAdd = () => {
        if (!isUnavailable) addToCart(item);
    };

    return (
        <div
            className={`menu-card food-${foodClass}${isUnavailable ? " out-of-stock-card" : ""}`}
            onClick={handleAdd}
            role="button"
        >
            <span className={`veg-dot veg-dot-${foodClass}`} aria-hidden="true">
                <i />
            </span>

            <div className="menu-details">
                <h3 className="menu-name">{item.item_name}</h3>
                {item.description && <p className="menu-desc">{item.description}</p>}
                <span className="menu-price">₹{Number(item.price).toFixed(0)}</span>
            </div>

            {isUnavailable && <span className="menu-unavailable-tag">Unavailable</span>}

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
