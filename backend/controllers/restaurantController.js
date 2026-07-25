const restaurantModel = require("../models/restaurantModel");

// Get all restaurants
exports.getAllRestaurants = (req, res) => {
    restaurantModel.getAllRestaurants((err, results) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch restaurants",
                error: err.message
            });
        }

        res.status(200).json({
            success: true,
            count: results.length,
            data: results
        });
    });
};

// Get restaurant by ID
exports.getRestaurantById = (req, res) => {
    const { id } = req.params;

    restaurantModel.getRestaurantById(id, (err, results) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch restaurant",
                error: err.message
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Restaurant not found"
            });
        }

        res.json({
            success: true,
            data: results[0]
        });
    });
};

// Create restaurant
exports.createRestaurant = (req, res) => {
    restaurantModel.createRestaurant(req.body, (err, result) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: "Failed to create restaurant",
                error: err.message
            });
        }

        res.status(201).json({
            success: true,
            message: "Restaurant created successfully",
            id: result.insertId
        });
    });
};

// Update restaurant
exports.updateRestaurant = (req, res) => {
    const { id } = req.params;

    restaurantModel.updateRestaurant(id, req.body, (err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: "Failed to update restaurant",
                error: err.message
            });
        }

        res.json({
            success: true,
            message: "Restaurant updated successfully"
        });
    });
};

// Delete restaurant
exports.deleteRestaurant = (req, res) => {
    const { id } = req.params;

    restaurantModel.deleteRestaurant(id, (err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: "Failed to delete restaurant",
                error: err.message
            });
        }

        res.json({
            success: true,
            message: "Restaurant deleted successfully"
        });
    });
};