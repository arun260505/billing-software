const authModel = require("../models/authModel");
const { success, error } = require("../utils/response");

exports.login = (req, res) => {

    const { username, password } = req.body;

    if (!username || !password) {
        return error(res, "Username and password are required.", 400);
    }

    authModel.login(username, password, (err, result) => {

        if (err) {
            return error(res, err.message, 500);
        }

        if (!result.success) {
            return error(res, result.message, 401);
        }

        return success(res, "Login successful.", {
            token: result.token,
            user: result.user
        });

    });

};

exports.me = (req, res) => {

    return success(res, "Authenticated user.", req.user);

};