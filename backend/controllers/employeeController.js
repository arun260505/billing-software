const employeeModel = require("../models/employeeModel");

exports.getEmployees = (req, res) => {

    employeeModel.getEmployees((err, results) => {

        if (err) {

            return res.status(500).json(err);

        }

        res.json(results);

    });

};
exports.addEmployee = (req, res) => {

    employeeModel.addEmployee(req.body, (err, data) => {

        if (err) {

            return res.status(500).json({
                success: false,
                message: err.message
            });

        }

        res.json({

            success: true,

            message: "Employee created successfully",

            credentials: {

                username: data.username,

                password: data.password

            }

        });

    });

};
exports.getSummary = (req, res) => {

    employeeModel.getSummary((err, results) => {

        if (err) {

            return res.status(500).json(err);

        }

        res.json(results);

    });

};