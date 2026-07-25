import React, { useEffect, useState } from "react";
import { getDailySales } from "../../services/reportService";

function DailySalesTable() {

    const [sales, setSales] = useState([]);

    useEffect(() => {
        loadDailySales();
    }, []);

    const loadDailySales = () => {
        getDailySales()
            .then((response) => {
                if (response.data.success) {
                    setSales(response.data.data);
                }
            })
            .catch((error) => {
                console.error("Daily Sales Error:", error);
            });
    };

    return (
        <div className="card shadow-sm mb-4">
            <div className="card-header">
                <h5 className="mb-0">Daily Sales Report</h5>
            </div>

            <div className="card-body">
                <table className="table table-bordered table-hover">
                    <thead className="table-dark">
                        <tr>
                            <th>Date</th>
                            <th>Total Orders</th>
                            <th>Total Sales</th>
                        </tr>
                    </thead>

                    <tbody>
                        {sales.length > 0 ? (
                            sales.map((item, index) => (
                                <tr key={index}>
                                    <td>
                                        {new Date(item.sale_date).toLocaleDateString("en-IN")}
                                    </td>
                                    <td>{item.total_orders}</td>
                                    <td>
                                        ₹{Number(item.total_sales).toLocaleString("en-IN")}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="3" className="text-center">
                                    No data available
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default DailySalesTable;