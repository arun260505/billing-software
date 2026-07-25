const db = require("../config/db");

// Get all restaurants
const getAllRestaurants = (callback) => {
    const sql = "SELECT * FROM restaurants ORDER BY id DESC";
    db.query(sql, callback);
};

// Get restaurant by ID
const getRestaurantById = (id, callback) => {
    const sql = "SELECT * FROM restaurants WHERE id = ?";
    db.query(sql, [id], callback);
};

// Create restaurant
const createRestaurant = (restaurant, callback) => {
    const sql = `
        INSERT INTO restaurants (
            restaurant_name,
            owner_name,
            mobile,
            email,
            gst_number,
            fssai_number,
            address,
            city,
            state,
            pincode,
            logo,
            opening_time,
            closing_time,
            tax,
            subscription,
            status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        restaurant.restaurant_name,
        restaurant.owner_name,
        restaurant.mobile,
        restaurant.email,
        restaurant.gst_number,
        restaurant.fssai_number,
        restaurant.address,
        restaurant.city,
        restaurant.state,
        restaurant.pincode,
        restaurant.logo,
        restaurant.opening_time,
        restaurant.closing_time,
        restaurant.tax,
        restaurant.subscription,
        restaurant.status
    ], callback);
};

// Update restaurant
const updateRestaurant = (id, restaurant, callback) => {
    const sql = `
        UPDATE restaurants SET
            restaurant_name=?,
            owner_name=?,
            mobile=?,
            email=?,
            gst_number=?,
            fssai_number=?,
            address=?,
            city=?,
            state=?,
            pincode=?,
            logo=?,
            opening_time=?,
            closing_time=?,
            tax=?,
            subscription=?,
            status=?
        WHERE id=?
    `;

    db.query(sql, [
        restaurant.restaurant_name,
        restaurant.owner_name,
        restaurant.mobile,
        restaurant.email,
        restaurant.gst_number,
        restaurant.fssai_number,
        restaurant.address,
        restaurant.city,
        restaurant.state,
        restaurant.pincode,
        restaurant.logo,
        restaurant.opening_time,
        restaurant.closing_time,
        restaurant.tax,
        restaurant.subscription,
        restaurant.status,
        id
    ], callback);
};

// Delete restaurant
const deleteRestaurant = (id, callback) => {
    db.query(
        "DELETE FROM restaurants WHERE id = ?",
        [id],
        callback
    );
};

module.exports = {
    getAllRestaurants,
    getRestaurantById,
    createRestaurant,
    updateRestaurant,
    deleteRestaurant
};