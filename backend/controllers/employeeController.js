const employeeModel = require("../models/employeeModel");

exports.getEmployees = (req, res) => {

    employeeModel.getEmployees(
        req.user.restaurant_id,
        (err, results) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            res.json({
                success: true,
                data: results
            });

        }
    );

};

exports.getSummary = (req, res) => {

    employeeModel.getSummary(
        req.user.restaurant_id,
        (err, summary) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            res.json({
                success: true,
                data: summary
            });

        }
    );

};

exports.addEmployee = (req, res) => {

    const employeeData = {
        ...req.body,
        restaurant_id: req.user.restaurant_id,
        created_by: req.user.id
    };

    employeeModel.addEmployee(employeeData, (err, result) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            message: "Employee created successfully.",
            credentials: {
                username: result.username,
                password: result.password
            }
        });

    });

};