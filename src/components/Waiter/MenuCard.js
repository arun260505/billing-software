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

    return (
        <div className="menu-card">
            {/* Food Image */}
            <div className="menu-image">
                <img
                    src={image}
                    alt={item.item_name}
                />
            </div>

            {/* Food Details */}
            <div className="menu-details">
                <h3>{item.item_name}</h3>

                <div className="menu-badges">
                    <span className="price-badge">
                        ₹{Number(item.price).toFixed(2)}
                    </span>

                    {item.available_quantity === 0 && (
                        <span className="stock-badge out-stock">
                            Out of Stock
                        </span>
                    )}
                </div>

                {item.available_quantity > 10 && (
                    <span className="best-seller">
                        ⭐ Best Seller
                    </span>
                )}
            </div>

            {/* Add to Cart Button */}
            <button
                className="add-cart-btn"
                disabled={item.available_quantity === 0}
                onClick={() => addToCart(item)}
            >
                {item.available_quantity === 0
                    ? "Out of Stock"
                    : "Add to Cart"}
            </button>
        </div>
    );
}

export default MenuCard;