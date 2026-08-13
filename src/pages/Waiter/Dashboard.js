import { useEffect, useState } from "react";
import TableGrid from "../../components/Waiter/TableGrid";
import { getTables, updateTableStatus } from "../../services/tableService";
import "../../styles/pages/Waiter/Dashboard.css";

import {
    getCategories,
    getItemsByCategory,
} from "../../services/menuService";

import {
    createOrder,
    getRunningOrders,
    getOrderDetails,
    updateOrder,
    cancelOrder
} from "../../services/orderService";

import RunningOrders from "../../components/Waiter/RunningOrders";
import Header from "../../components/Waiter/Header";
import CategoryTabs from "../../components/Waiter/CategoryTabs";
import MenuCard from "../../components/Waiter/MenuCard";
import OrderSummary from "../../components/Waiter/OrderSummary";

function Dashboard() {
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);
    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [cart, setCart] = useState([]);
    const [runningOrders, setRunningOrders] = useState([]);
    const [editingOrder, setEditingOrder] = useState(null);
    const [showRunningOrders, setShowRunningOrders] = useState(false);
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
        loadTables();
        loadRunningOrders();
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
        (sum, item) => sum + Number(item.quantity),
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
                    isNew: true,
                },
            ];
        });
    };

    const newOrder = () => {
        setCart([]);
        setEditingOrder(null);
        setOrderNumber(prev => prev + 1);
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

const loadTables = async () => {
    try {
        const data = await getTables();
        setTables(data.data);
    } catch (error) {
        console.error(error);
    }
};

const handleSelectTable = async (table) => {

    setSelectedTable(table);

    await loadCategories();

    if (table.status === "OCCUPIED") {

        const runningOrder = runningOrders.find(
            (order) => order.table_id === table.id
        );

        if (runningOrder) {
            await openOrder(runningOrder);
        } else {
            alert("No running order found for this table.");
        }
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

    const loadRunningOrders = async () => {
        try {
            const response = await getRunningOrders();
            setRunningOrders(response.data.data);
        } catch (error) {
            console.error("Error loading running orders:", error);
        }
    };

    const openOrder = async (order) => {

    try {

        const response = await getOrderDetails(order.id);

        const items = response.data.data.map(item => ({
    id: item.menu_item_id,
    menu_item_id: item.menu_item_id,
    item_name: item.item_name,
    quantity: item.quantity,
    originalQuantity: item.quantity,
    price: Number(item.price),
    gst: 5,
    available_quantity: 999,
    isNew: false
}));

        setCart(items);

        setEditingOrder(order);

        setShowRunningOrders(false);

    } catch (error) {

        console.error(error);

        alert("Failed to load order.");

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

    const handleChangeTable = async () => {
        if (cart.length > 0) {
            const confirmDiscard = window.confirm(
                "You have an unfinished order. Discard it?"
            );

            if (!confirmDiscard) {
                return;
            }
        }

        setSelectedTable(null);
        setCart([]);
        setEditingOrder(null);

        await loadTables();
    };

    const placeOrder = async () => {
        if (cart.length === 0) {
            alert("Please add items.");
            return;
        }


    

        const orderData = {
    order_number: `ORD-${Date.now()}`,
    waiter_id: 1,
    table_id: selectedTable.id,
    items: cart.map(item => ({
        menu_item_id: item.id,
        quantity: item.quantity,
        price: item.price,
        gst: item.gst
    }))
};

        try {
            console.log("Order Data:", orderData);

            if (editingOrder) {
                await updateOrder(editingOrder.id, orderData);
                alert("Order Updated Successfully");
                setEditingOrder(null);
            } else {
                await createOrder(orderData);

if (selectedTable) {
    await updateTableStatus(selectedTable.id, "OCCUPIED");

    // Update the selected table locally
    setSelectedTable({
        ...selectedTable,
        status: "OCCUPIED",
    });

    await loadTables();
}

alert("Order Sent To Kitchen");
                setOrderNumber(prev => prev + 1);
            }

            setCart([]);
            setSelectedTable(null);
            setEditingOrder(null);
            updateDateTime();
            await loadTables();
            await loadRunningOrders();
        } catch (error) {
            console.error("Order Error:", error);
            console.log("Response:", error.response);
            console.log("Data:", error.response?.data);
            alert(error.response?.data?.message || "Failed to place order.");
        }
    };


    const handleCancelOrder = async () => {

    if (!editingOrder) {
        alert("Please open an existing order first.");
        return;
    }

    const confirmCancel = window.confirm(
        "Are you sure you want to cancel this order?"
    );

    if (!confirmCancel) return;

    try {

        await cancelOrder(editingOrder.id);

if (selectedTable) {
    await updateTableStatus(selectedTable.id, "FREE");

    setSelectedTable({
        ...selectedTable,
        status: "FREE",
    });

    await loadTables();
}

alert("Order Cancelled Successfully");

setCart([]);
setSelectedTable(null);
setEditingOrder(null);

await loadTables();
await loadRunningOrders();

    } catch (error) {

        console.error(error);

        alert("Failed to cancel order.");

    }

};

    

    return (
        <div className="waiter-dashboard">
            {!selectedTable ? (
                <>
                    <div className="table-selection-header">
                        <h2>Select a Table</h2>
                    </div>
                    <TableGrid
                        tables={tables}
                        onSelectTable={handleSelectTable}
                    />
                </>
            ) : (
                <>
                    <Header
                        orderNumber={
                            editingOrder
                                ? editingOrder.order_number
                                : `ORD-${orderNumber}`
                        }
                        waiterName={waiterName}
                        currentDate={currentDate}
                        currentTime={currentTime}
                        newOrder={newOrder}
                        openRunningOrders={() =>
                            setShowRunningOrders(true)
                        }
                    />

                    <div className="selected-table-bar">
                        <span>Table {selectedTable.table_number}</span>
                        <button
                            className="back-to-tables-btn"
                            onClick={handleChangeTable}
                        >
                            ← Change Table
                        </button>
                    </div>

                    {showRunningOrders && (
                        <RunningOrders
                            runningOrders={runningOrders}
                            closeOrders={() => setShowRunningOrders(false)}
                            openOrder={openOrder}
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
                            handleCancelOrder={handleCancelOrder}
                            editingOrder={editingOrder}
                            increaseQuantity={increaseQuantity}
                            decreaseQuantity={decreaseQuantity}
                            removeItem={removeItem}
                        />
                    </div>
                </>
            )}
        </div>
    );
}

export default Dashboard;
