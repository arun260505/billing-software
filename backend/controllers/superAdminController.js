const db = require("../config/db");
const bcrypt = require("bcrypt");

const createAdmin = async (req, res) => {

    try {

        const {
            fullName,
            username,
            password
        } = req.body;

        if (!fullName || !username || !password) {

            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });

        }

        db.query(

            "SELECT * FROM users WHERE username=?",

            [username],

            async (err, result) => {

                if (err) {

                    return res.status(500).json({
                        success: false,
                        message: err.message
                    });

                }

                if (result.length > 0) {

                    return res.status(400).json({
                        success: false,
                        message: "Username already exists."
                    });

                }

                const hashedPassword = await bcrypt.hash(password, 10);

                db.query(

                    `INSERT INTO users
                    (username,password,full_name,role,created_by)
                    VALUES(?,?,?,?,?)`,

                    [
                        username,
                        hashedPassword,
                        fullName,
                        "admin",
                        1
                    ],

                    (err) => {

                        if (err) {

                            return res.status(500).json({
                                success: false,
                                message: err.message
                            });

                        }

                        return res.json({
                            success: true,
                            message: "Admin Created Successfully"
                        });

                    }

                );

            }

        );

    }

    catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

const getAdmins = (req, res) => {

    db.query(

        `SELECT
            id,
            username,
            full_name,
            status,
            created_at
        FROM users
        WHERE role='admin'
        ORDER BY id DESC`,

        (err, result) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: err.message
                });

            }

            res.json({
                success: true,
                admins: result
            });

        }

    );

};

const deleteAdmin = (req, res) => {

    const { id } = req.params;

    db.query(

        "DELETE FROM users WHERE id=?",

        [id],

        (err) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: err.message
                });

            }

            res.json({
                success: true,
                message: "Admin Deleted Successfully"
            });

        }

    );

};

module.exports = {
    createAdmin,
    getAdmins,
    deleteAdmin
};