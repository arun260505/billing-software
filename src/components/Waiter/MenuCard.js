import startersImage from "../../assets/startersImage.jpg";
import breakfastImage from "../../assets/breakfastImage.jpg";
import lunchImage from "../../assets/lunchImage.jpg";
import dinnerImage from "../../assets/dinnerImage.jpg";
import dessertsImage from "../../assets/dessertsImage.jpg";
import beveragesImage from "../../assets/beveragesImage.jpg";
import juicesImage from "../../assets/juicesImage.jpg";
import iceCreamImage from "../../assets/iceCreamImage.jpg";
import comboImage from "../../assets/comboImage.jpg";

// onToggleAvailability is optional — only the cashier passes it, which shows the
// "Mark Available / Unavailable" toggle on each card.
function MenuCard({ item, addToCart, onToggleAvailability }) {

    const categoryImages = {
        "Starters": startersImage,
        "Breakfast": breakfastImage,
        "Lunch": lunchImage,
        "Dinner": dinnerImage,
        "Desserts": dessertsImage,
        "Beverages": beveragesImage,
        "Juices": juicesImage,
        "Ice Cream": iceCreamImage,
        "Combo Meals": comboImage,
    };

    const image = categoryImages[item.category_name] || lunchImage;

    const isUnavailable = Number(item.available_quantity) === 0;

    return (
        <div className={`menu-card${isUnavailable ? " out-of-stock-card" : ""}`}>
            {/* Food Image */}
            <div className="menu-image">
                <img src={image} alt={item.item_name} />
                {isUnavailable && (
                    <div className="out-of-stock-overlay">Unavailable</div>
                )}
            </div>

            {/* Food Details */}
            <div className="menu-details">
                <div className="menu-info">
                    <h3>{item.item_name}</h3>
                    <span className="menu-price">₹{Number(item.price).toFixed(0)}</span>
                </div>

                <button
                    className="add-cart-btn"
                    disabled={isUnavailable}
                    onClick={() => addToCart(item)}
                    title={isUnavailable ? "Unavailable" : "Add to cart"}
                >
                    +
                </button>
            </div>

            {/* Cashier-only availability toggle */}
            {onToggleAvailability && (
                <button
                    className={`avail-toggle${isUnavailable ? " is-off" : " is-on"}`}
                    onClick={() => onToggleAvailability(item)}
                    title={isUnavailable ? "Mark available" : "Mark unavailable"}
                >
                    {isUnavailable ? "✓ Mark Available" : "✕ Mark Unavailable"}
                </button>
            )}
        </div>
    );
}

export default MenuCard;
