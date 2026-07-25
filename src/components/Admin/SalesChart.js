import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

import { getSalesChart } from "../../services/dashboardService";
import "../../styles/Admin/Chart.css";

function SalesChart() {
  const [period, setPeriod] = useState("today");

  const [chartData, setChartData] = useState([]);
useEffect(() => {
    fetchChartData();
}, [period]);
  const fetchChartData = () => {
    getSalesChart(period)
      .then((response) => {
        if (response.data.success) {
          const formattedData = response.data.data.map((item) => {

    let label = item.label;

    if (period === "today") {

        label = `${item.label}:00`;

    } else {

        label = new Date(item.label).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short"
        });

    }

    return {
        label,
        sales: Number(item.sales)
    };

});
          

          setChartData(formattedData);
        }
      })
      .catch((error) => {
        console.error("Sales Chart Error:", error);
      });
  };

  return (
    <div className="chart-card">

      <div className="chart-header">
        <h3>Sales Overview</h3>
      </div>
      <select
    value={period}
    onChange={(e) => setPeriod(e.target.value)}
>
    <option value="today">Today</option>
    <option value="week">This Week</option>
    <option value="month">This Month</option>
</select>


      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>

          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="label" />

          <YAxis />

          <Tooltip />

          <Line
            type="monotone"
            dataKey="sales"
            stroke="#2563EB"
            strokeWidth={3}
          />

        </LineChart>
      </ResponsiveContainer>

    </div>
  );
}

export default SalesChart;