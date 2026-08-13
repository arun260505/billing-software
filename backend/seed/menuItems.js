require("dotenv").config();

const db = require("../config/db");

const RESTAURANT_ID = 1;

const menuByCategory = {
    Beverages: [
        ["Coke", 40],
        ["Pepsi", 40],
        ["Sprite", 40],
        ["Fanta", 40],
        ["Thumbs Up", 45],
        ["Soda Lime", 35],
        ["Mineral Water", 20],
        ["Masala Soda", 45],
        ["Lemon Iced Tea", 70],
        ["Peach Iced Tea", 75],
        ["Cold Coffee", 90],
        ["Hot Coffee", 60],
        ["Cappuccino", 110],
        ["Cafe Latte", 120],
        ["Masala Chai", 35],
        ["Green Tea", 50],
        ["Badam Milk", 85],
        ["Rose Milk", 80],
        ["Fresh Lime Soda", 60],
        ["Ginger Lemon Tea", 55]
    ],
    Breakfast: [
        ["Idli", 40],
        ["Mini Idli", 55],
        ["Ghee Idli", 70],
        ["Plain Dosa", 60],
        ["Masala Dosa", 85],
        ["Onion Dosa", 90],
        ["Rava Dosa", 95],
        ["Podi Dosa", 90],
        ["Poori Masala", 80],
        ["Pongal", 75],
        ["Upma", 60],
        ["Vada", 25],
        ["Sambar Vada", 55],
        ["Pesarattu", 95],
        ["Appam", 80],
        ["Set Dosa", 85],
        ["Parotta Kurma", 90],
        ["Aloo Paratha", 100],
        ["Chole Bhature", 120],
        ["Bread Omelette", 70]
    ],
    "Combo Meals": [
        ["Veg Mini Meal", 180],
        ["South Indian Thali", 220],
        ["North Indian Thali", 240],
        ["Paneer Combo", 260],
        ["Chicken Biryani Combo", 320],
        ["Mutton Biryani Combo", 380],
        ["Fried Rice Combo", 260],
        ["Noodles Combo", 250],
        ["Burger Combo", 220],
        ["Pizza Combo", 320],
        ["Family Veg Combo", 550],
        ["Family Chicken Combo", 720],
        ["Breakfast Combo", 160],
        ["Lunch Combo", 240],
        ["Dinner Combo", 260],
        ["Tandoori Combo", 360],
        ["Snacks Combo", 180],
        ["Wrap Combo", 210],
        ["Kids Combo", 150],
        ["Executive Meal", 280]
    ],
    Desserts: [
        ["Gulab Jamun", 60],
        ["Rasgulla", 60],
        ["Rasmalai", 90],
        ["Double Ka Meetha", 95],
        ["Apricot Delight", 140],
        ["Chocolate Brownie", 120],
        ["Brownie With Ice Cream", 160],
        ["Caramel Custard", 110],
        ["Fruit Salad", 100],
        ["Fruit Salad With Ice Cream", 145],
        ["Khubani Ka Meetha", 130],
        ["Basundi", 95],
        ["Kheer", 80],
        ["Payasam", 75],
        ["Cheesecake Slice", 170],
        ["Chocolate Mousse", 130],
        ["Tiramisu Cup", 180],
        ["Red Velvet Pastry", 140],
        ["Malai Kulfi", 90],
        ["Jalebi With Rabdi", 150]
    ],
    Dinner: [
        ["Butter Naan", 45],
        ["Garlic Naan", 60],
        ["Tandoori Roti", 30],
        ["Rumali Roti", 35],
        ["Veg Fried Rice", 160],
        ["Chicken Fried Rice", 220],
        ["Veg Noodles", 150],
        ["Chicken Noodles", 210],
        ["Paneer Butter Masala", 220],
        ["Kadai Paneer", 230],
        ["Veg Kurma", 180],
        ["Dal Tadka", 160],
        ["Butter Chicken", 290],
        ["Chicken Curry", 250],
        ["Mutton Curry", 340],
        ["Egg Curry", 180],
        ["Veg Pulao", 170],
        ["Jeera Rice", 140],
        ["Hyderabadi Chicken Biryani", 260],
        ["Mutton Biryani", 340]
    ],
    "Ice Cream": [
        ["Vanilla Scoop", 50],
        ["Chocolate Scoop", 60],
        ["Strawberry Scoop", 60],
        ["Butterscotch Scoop", 60],
        ["Black Currant Scoop", 65],
        ["Mango Scoop", 60],
        ["Pista Scoop", 65],
        ["Kulfi Scoop", 70],
        ["Vanilla Sundae", 110],
        ["Chocolate Sundae", 120],
        ["Butterscotch Sundae", 120],
        ["Hot Chocolate Fudge", 150],
        ["Banana Split", 160],
        ["American Nuts", 140],
        ["Cassata", 90],
        ["Choco Bar", 50],
        ["Mango Bar", 45],
        ["Tender Coconut Ice Cream", 130],
        ["Sitaphal Ice Cream", 130],
        ["Family Pack Vanilla", 220]
    ],
    Juices: [
        ["Orange Juice", 80],
        ["Mosambi Juice", 80],
        ["Watermelon Juice", 75],
        ["Pineapple Juice", 85],
        ["Mango Juice", 95],
        ["Apple Juice", 95],
        ["Grape Juice", 90],
        ["Pomegranate Juice", 110],
        ["Carrot Juice", 80],
        ["Beetroot Juice", 80],
        ["ABC Juice", 120],
        ["Lemon Mint Juice", 70],
        ["Kiwi Juice", 120],
        ["Papaya Juice", 85],
        ["Mixed Fruit Juice", 110],
        ["Tender Coconut Water", 60],
        ["Sugarcane Juice", 70],
        ["Avocado Smoothie", 140],
        ["Banana Shake", 110],
        ["Chikoo Shake", 115]
    ],
    Lunch: [
        ["Veg Meals", 120],
        ["Special Veg Meals", 160],
        ["Chicken Biryani", 220],
        ["Chicken Dum Biryani", 240],
        ["Veg Biryani", 170],
        ["Paneer Biryani", 210],
        ["Curd Rice", 90],
        ["Sambar Rice", 100],
        ["Tomato Rice", 100],
        ["Lemon Rice", 95],
        ["Jeera Rice", 140],
        ["Veg Fried Rice", 160],
        ["Paneer Fried Rice", 190],
        ["Mushroom Fried Rice", 190],
        ["Egg Fried Rice", 180],
        ["Fish Meals", 240],
        ["Mutton Keema Rice", 230],
        ["Rajma Rice", 130],
        ["Dal Khichdi", 140],
        ["Curd Meal Combo", 150]
    ],
    Starters: [
        ["Chicken 65", 180],
        ["Gobi 65", 120],
        ["Paneer 65", 170],
        ["Chilli Chicken", 210],
        ["Dragon Chicken", 230],
        ["Chicken Lollipop", 220],
        ["Pepper Chicken", 240],
        ["Apollo Fish", 260],
        ["Chilli Paneer", 190],
        ["Crispy Corn", 150],
        ["Veg Manchurian", 160],
        ["Mushroom 65", 170],
        ["Baby Corn Manchurian", 180],
        ["Hara Bhara Kebab", 160],
        ["Tandoori Chicken Half", 280],
        ["Tandoori Chicken Full", 520],
        ["Fish Finger", 260],
        ["Prawn Fry", 320],
        ["Spring Rolls", 150],
        ["Cheese Balls", 180]
    ]
};

function ensureCategory(categoryName) {
    return new Promise((resolve, reject) => {
        const findSql = `
            SELECT id
            FROM categories
            WHERE category_name = ? AND restaurant_id = ?
            LIMIT 1
        `;

        db.query(findSql, [categoryName, RESTAURANT_ID], (findErr, rows) => {
            if (findErr) {
                reject(findErr);
                return;
            }

            if (rows.length > 0) {
                resolve(rows[0].id);
                return;
            }

            const insertSql = `
                INSERT INTO categories (restaurant_id, category_name, status)
                VALUES (?, ?, 'Active')
            `;

            db.query(insertSql, [RESTAURANT_ID, categoryName], (insertErr, result) => {
                if (insertErr) {
                    reject(insertErr);
                    return;
                }

                resolve(result.insertId);
            });
        });
    });
}

function insertItemIfMissing(categoryId, itemName, price) {
    return new Promise((resolve, reject) => {
        const findSql = `
            SELECT id
            FROM menu_items
            WHERE category_id = ? AND item_name = ?
            LIMIT 1
        `;

        db.query(findSql, [categoryId, itemName], (findErr, rows) => {
            if (findErr) {
                reject(findErr);
                return;
            }

            if (rows.length > 0) {
                resolve(false);
                return;
            }

            const insertSql = `
                INSERT INTO menu_items
                (restaurant_id, category_id, item_name, price, gst, available)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            db.query(
                insertSql,
                [RESTAURANT_ID, categoryId, itemName, price, 5, 1],
                (insertErr) => {
                    if (insertErr) {
                        reject(insertErr);
                        return;
                    }

                    resolve(true);
                }
            );
        });
    });
}

async function seedMenuItems() {
    try {
        let insertedCount = 0;

        for (const [categoryName, items] of Object.entries(menuByCategory)) {
            const categoryId = await ensureCategory(categoryName);

            for (const [itemName, price] of items) {
                const inserted = await insertItemIfMissing(
                    categoryId,
                    itemName,
                    price
                );

                if (inserted) {
                    insertedCount += 1;
                }
            }
        }

        console.log(
            `Menu seeding complete. Added ${insertedCount} new menu items.`
        );
    } catch (error) {
        console.error("Menu seeding failed.");
        console.error(error.message);
    } finally {
        process.exit();
    }
}

seedMenuItems();
