const employeeModel = require("../models/employeeModel");
const { success, error } = require("../utils/response");

exports.getEmployees = (req, res) => {

    employeeModel.getEmployees(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Employees fetched.", results);

    });

};

exports.getSummary = (req, res) => {

    employeeModel.getSummary(req.user.restaurant_id, (err, summary) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Employee summary fetched.", summary);

    });

};

exports.addEmployee = (req, res) => {

    const employeeData = {
        ...req.body,
        restaurant_id: req.user.restaurant_id,
        created_by: req.user.id
    };

    employeeModel.addEmployee(employeeData, (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Employee created successfully.", {
            username: result.username,
            password: result.password
        }, 201);

    });

};
