import React, { useEffect, useState } from "react";
import { getRecentOrders } from "../../services/dashboardService";
import "../../styles/Admin/Table.css";

function RecentOrders() {

    const [orders, setOrders] = useState([]);

useEffect(() => {
    fetchRecentOrders();
}, []);

const fetchRecentOrders = () => {
    getRecentOrders()
        .then((response) => {
            if (response.data.success) {
                setOrders(response.data.data);
            }
        })
        .catch((error) => {
            console.error("Recent Orders Error:", error);
        });
};

    return (

        <div className="table-card">

            <h3>Recent Orders</h3>

            <table>
                <thead>
    <tr>
        <th>Order</th>
        <th>Amount</th>
        <th>Status</th>
        <th>Time</th>
    </tr>
</thead>

<tbody>
    {orders.map((order) => (
        <tr key={order.order_number}>
            <td>{order.order_number}</td>
            <td>₹{Number(order.grand_total).toLocaleString("en-IN")}</td>
            <td>{order.order_status}</td>
            <td>{new Date(order.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            })}</td>
        </tr>
    ))}
</tbody>

               

            </table>

        </div>

    );

}

export default RecentOrders;