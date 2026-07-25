
import "../../styles/Admin/DashboardCard.css";
import React, { useEffect, useState } from "react";
import { getTopItems } from "../../services/dashboardService";

function TopSelling() {
  const [items, setItems] = useState([]);

useEffect(() => {
    fetchTopItems();
}, []);

const fetchTopItems = () => {
    getTopItems()
        .then((response) => {
            if (response.data.success) {
                setItems(response.data.data);
            }
        })
        .catch((error) => {
            console.error("Top Items Error:", error);
        });
};
 

  return (
    <div className="dashboard-widget">
      <h3>Top Selling Items</h3>
      {items.map((item, index) => (
  <div className="progress-item" key={index}>
    <div className="progress-title">
      <span>{item.item_name}</span>
      <span>{item.total_qty}</span>
    </div>

    <div className="progress-bar">
      <div
        className="progress-fill"
        style={{
          width: `${Math.min(item.total_qty * 10, 100)}%`
        }}
      ></div>
    </div>
  </div>
))}

      
        
    
    </div>
  );
}

export default TopSelling;