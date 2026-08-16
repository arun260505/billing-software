// Clean mobile menu card: veg / non-veg dot, name, description, price.
// A "+" button adds the item; once in the cart it becomes a  − qty +  stepper.
// onToggleAvailability is optional — only the cashier passes it, which shows the
// "Mark Available / Unavailable" toggle on each card.
function MenuCard({ item, addToCart, removeOneFromCart, quantity = 0, onToggleAvailability }) {

    const isUnavailable = Number(item.available_quantity) === 0;

    // Veg / Egg / NonVeg → the little square-dot indicator colour.
    const ft = String(item.food_type || "Veg").toLowerCase();
    const foodClass = ft.includes("non") ? "nonveg" : ft.includes("egg") ? "egg" : "veg";

    return (
        <div className={`menu-card food-${foodClass}${isUnavailable ? " out-of-stock-card" : ""}`}>
            <span className={`veg-dot veg-dot-${foodClass}`} aria-hidden="true">
                <i />
            </span>

            <div className="menu-details">
                <h3 className="menu-name">{item.item_name}</h3>
                {item.description && <p className="menu-desc">{item.description}</p>}

                <div className="menu-card-bottom">
                    <span className="menu-price">₹{Number(item.price).toFixed(0)}</span>

                    {isUnavailable ? (
                        <span className="menu-unavailable-tag">Unavailable</span>
                    ) : quantity > 0 ? (
                        <div className="mc-stepper">
                            <button className="mc-step" onClick={() => removeOneFromCart && removeOneFromCart(item)}>−</button>
                            <span className="mc-qty">{quantity}</span>
                            <button className="mc-step mc-step-add" onClick={() => addToCart(item)}>+</button>
                        </div>
                    ) : (
                        <button className="mc-add" onClick={() => addToCart(item)} title="Add to order">+</button>
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
