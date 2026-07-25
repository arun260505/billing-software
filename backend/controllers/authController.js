const authModel = require("../models/authModel");

exports.login = (req, res) => {

    authModel.login(req.body, (err, result) => {

        if (err) {

            return res.status(500).json({
                success: false,
                message: err.message
            });

        }

        if (!result.success) {

            return res.status(401).json(result);

        }

        res.json(result);

    });

};