import { useEffect, useState } from "react";
import "../../styles/pages/Waiter/Dashboard.css";
import {
    getCategories,
    getItemsByCategory,
} from "../../services/menuService";
import RunningOrders from "../../components/Waiter/RunningOrders";
import Header from "../../components/Waiter/Header";
import CategoryTabs from "../../components/Waiter/CategoryTabs";
import MenuCard from "../../components/Waiter/MenuCard";
import OrderSummary from "../../components/Waiter/OrderSummary";

function Dashboard() {
    const [categories, setCategories] = useState([]);
const [menuItems, setMenuItems] = useState([]);

    const [selectedCategory, setSelectedCategory] =
    useState(null);
    
    const [cart, setCart] = useState([]);
    const [runningOrders, setRunningOrders] = useState([]);
    const [showRunningOrders, setShowRunningOrders] =
        useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [orderNumber, setOrderNumber] = useState(1001);
    const [waiterName] = useState("John");
    const [currentDate, setCurrentDate] = useState("");
    const [currentTime, setCurrentTime] = useState("");

    function updateDateTime() {
        const now = new Date();

        setCurrentDate(now.toLocaleDateString("en-GB"));
        setCurrentTime(
            now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            })
        );
    }

    useEffect(() => {
        updateDateTime();
        loadCategories();
    }, []);

    useEffect(() => {
    if (selectedCategory) {
        loadMenuItems(selectedCategory);
    }
}, [selectedCategory]);

    const selectedItems = menuItems;

    const filteredItems = selectedItems.filter((item) =>
    item.item_name
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
);

    const totalItems = cart.reduce(
        (sum, item) => sum + item.quantity,
        0
    );

    const subtotal = cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );

    const gst = subtotal * 0.05;
    const grandTotal = subtotal + gst;

    const addToCart = (item) => {
        setCart((prevCart) => {
            const existingItem = prevCart.find(
                (cartItem) => cartItem.id === item.id
            );

            if (existingItem) {
                if (existingItem.quantity >= item.available_quantity) {
                    alert(`Only ${item.available_quantity} items available.`);
                    return prevCart;
                }

                return prevCart.map((cartItem) =>
                    cartItem.id === item.id
                        ? {
                              ...cartItem,
                              quantity: cartItem.quantity + 1,
                          }
                        : cartItem
                );
            }

            return [
                ...prevCart,
                {
                    ...item,
                    quantity: 1,
                },
            ];
        });
    };

    const newOrder = () => {
        setCart([]);
        setOrderNumber((prev) => prev + 1);
        updateDateTime();
    };

    const loadCategories = async () => {
    try {
        const response = await getCategories();

        setCategories(response.data.data);

        if (response.data.data.length > 0) {
            setSelectedCategory(response.data.data[0].id);
        }
    } catch (error) {
        console.error(error);
    }
};

const loadMenuItems = async (categoryId) => {
    try {
        const response = await getItemsByCategory(categoryId);

        setMenuItems(response.data.data);
    } catch (error) {
        console.error(error);
    }
};

    const increaseQuantity = (id) => {
        setCart((prevCart) =>
            prevCart.map((item) => {
                if (item.id !== id) {
                    return item;
                }

                if (item.quantity >= item.available_quantity) {
    alert(`Only ${item.available_quantity} items available.`);
    return item;
}

                return {
                    ...item,
                    quantity: item.quantity + 1,
                };
            })
        );
    };

    const decreaseQuantity = (id) => {
        setCart((prevCart) =>
            prevCart
                .map((item) =>
                    item.id === id
                        ? {
                              ...item,
                              quantity: item.quantity - 1,
                          }
                        : item
                )
                .filter((item) => item.quantity > 0)
        );
    };

    const removeItem = (id) => {
        setCart((prevCart) =>
            prevCart.filter((item) => item.id !== id)
        );
    };

    const clearCart = () => {
        setCart([]);
    };

    const placeOrder = () => {
        if (cart.length === 0) {
            alert("Please add items.");
            return;
        }

        const order = {
            orderNumber: `ORD-${orderNumber}`,
            items: cart,
            totalItems,
            subtotal,
            gst,
            grandTotal,
            status: "Pending",
            date: currentDate,
            time: currentTime,
        };

        setRunningOrders((prev) => [...prev, order]);
        alert("Order Sent To Kitchen");
        setCart([]);
        setOrderNumber((prev) => prev + 1);
        updateDateTime();
    };

    return (
        <div className="waiter-dashboard">
            <Header
                orderNumber={`ORD-${orderNumber}`}
                waiterName={waiterName}
                currentDate={currentDate}
                currentTime={currentTime}
                newOrder={newOrder}
                openRunningOrders={() =>
                    setShowRunningOrders(true)
                }
            />

            {showRunningOrders && (
                <RunningOrders
                    runningOrders={runningOrders}
                    closeOrders={() =>
                        setShowRunningOrders(false)
                    }
                />
            )}

            <div className="dashboard-content">
                <div className="left-panel">
                    <CategoryTabs
    categories={categories}
    selectedCategory={selectedCategory}
    onSelectCategory={setSelectedCategory}
/>

                    <div className="search-bar">
                        <input
                            type="text"
                            placeholder="Search Menu Items..."
                            value={searchTerm}
                            onChange={(e) =>
                                setSearchTerm(e.target.value)
                            }
                        />
                    </div>

                    <div className="menu-items">
                        {filteredItems.length === 0 ? (
                            <h3>No Items Available</h3>
                        ) : (
                            filteredItems.map((item) => (
                                <MenuCard
                                    key={item.id}
                                    item={item}
                                    addToCart={addToCart}
                                />
                            ))
                        )}
                    </div>
                </div>

                <OrderSummary
                    cart={cart}
                    totalItems={totalItems}
                    subtotal={subtotal}
                    gst={gst}
                    grandTotal={grandTotal}
                    clearCart={clearCart}
                    placeOrder={placeOrder}
                    increaseQuantity={increaseQuantity}
                    decreaseQuantity={decreaseQuantity}
                    removeItem={removeItem}
                />
            </div>
        </div>
    );
}

export default Dashboard;
