import startersImage from "../../assets/startersImage.jpg";
import breakfastImage from "../../assets/breakfastImage.jpg";
import lunchImage from "../../assets/lunchImage.jpg";
import dinnerImage from "../../assets/dinnerImage.jpg";
import dessertsImage from "../../assets/dessertsImage.jpg";
import beveragesImage from "../../assets/beveragesImage.jpg";
import juicesImage from "../../assets/juicesImage.jpg";
import iceCreamImage from "../../assets/iceCreamImage.jpg";
import comboImage from "../../assets/comboImage.jpg";

function CartItem({ item, increaseQuantity, decreaseQuantity, removeItem }) {
    const quantity         = Number(item.quantity) || 0;
    const originalQuantity = Number(item.originalQuantity) || 0;
    const price            = Number(item.price) || 0;
    const lineTotal        = price * quantity;

    const quantityIncreased = !item.isNew && item.originalQuantity !== undefined && quantity > originalQuantity;
    const addedCount        = quantityIncreased ? quantity - originalQuantity : 0;
    const quantityDecreased = !item.isNew && item.originalQuantity !== undefined && quantity < originalQuantity;
    const cancelledCount    = quantityDecreased ? originalQuantity - quantity : 0;

    const categoryImages = {
        "Starters":   startersImage,
        "Breakfast":  breakfastImage,
        "Lunch":      lunchImage,
        "Dinner":     dinnerImage,
        "Desserts":   dessertsImage,
        "Beverages":  beveragesImage,
        "Juices":     juicesImage,
        "Ice Cream":  iceCreamImage,
        "Combo Meals":comboImage,
    };
    const image = categoryImages[item.category_name] || lunchImage;

    return (
        <div className={`cart-item-row${item.isNew ? " cir-new" : ""}`}>
            {/* Food image */}
            <div className="cir-img-wrap">
                <img src={image} alt={item.item_name} className="cir-img" />
            </div>

            {/* Info */}
            <div className="cir-info">
                <span className="cir-name">{item.item_name || item.name}</span>
                <div className="cir-badges">
                    {item.isNew          && <span className="cir-badge cir-badge-new">NEW</span>}
                    {quantityIncreased   && <span className="cir-badge cir-badge-added">+{addedCount} Added</span>}
                    {quantityDecreased   && <span className="cir-badge cir-badge-cancelled">−{cancelledCount} Cancelled</span>}
                </div>
                <span className="cir-price">₹{price} × {quantity} = <strong>₹{lineTotal}</strong></span>
            </div>

            {/* Controls */}
            <div className="cir-controls">
                <button className="cir-btn" onClick={() => decreaseQuantity(item.id)}>−</button>
                <span className="cir-qty">{quantity}</span>
                <button className="cir-btn" onClick={() => increaseQuantity(item.id)}>+</button>
                <button className="cir-remove" onClick={() => removeItem(item.id)}>✕</button>
            </div>
        </div>
    );
}

export default CartItem;
