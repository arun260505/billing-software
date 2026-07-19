import chickenImage from "../../assets/chicken.jpg";

function MenuCard({ item, addToCart }) {
    return (
        <div className="menu-card">
            {/* Food Image */}
            <div className="menu-image">
                <img
                    src={chickenImage}
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