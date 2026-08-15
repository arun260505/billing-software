import startersImage from "../../assets/startersImage.jpg";
import breakfastImage from "../../assets/breakfastImage.jpg";
import lunchImage from "../../assets/lunchImage.jpg";
import dinnerImage from "../../assets/dinnerImage.jpg";
import dessertsImage from "../../assets/dessertsImage.jpg";
import beveragesImage from "../../assets/beveragesImage.jpg";
import juicesImage from "../../assets/juicesImage.jpg";
import iceCreamImage from "../../assets/iceCreamImage.jpg";
import comboImage from "../../assets/comboImage.jpg";

function MenuCard({ item, addToCart }) {

     console.log(item);

    

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

    const isOutOfStock = item.available_quantity === 0;

    return (
        <div className={`menu-card${isOutOfStock ? " out-of-stock-card" : ""}`}>
            {/* Food Image */}
            <div className="menu-image">
                <img
                    src={image}
                    alt={item.item_name}
                />
                {isOutOfStock && (
                    <div className="out-of-stock-overlay">Out of Stock</div>
                )}
            </div>

            {/* Food Details */}
            <div className="menu-details">
                <div className="menu-info">
                    <h3>{item.item_name}</h3>
                    <span className="menu-price">₹{Number(item.price).toFixed(0)}</span>
                </div>

                {/* Add to Cart Button */}
                <button
                    className="add-cart-btn"
                    disabled={isOutOfStock}
                    onClick={() => addToCart(item)}
                    title={isOutOfStock ? "Out of Stock" : "Add to cart"}
                >
                    +
                </button>
            </div>
        </div>
    );
}

export default MenuCard;