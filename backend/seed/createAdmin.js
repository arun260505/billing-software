require("dotenv").config();

const bcrypt = require("bcryptjs");
const db = require("../config/db");

const createAdmin = () => {

    const checkQuery = "SELECT * FROM users WHERE username = ?";

    db.query(checkQuery, ["admin2@gmail.com"], (err, result) => {

        if (err) {
            console.log(err);
            process.exit();
        }

        if (result.length > 0) {
            console.log("✅ Admin already exists.");
            process.exit();
        }

        bcrypt.hash("Admin@123", 10, (err, hashedPassword) => {

            if (err) {
                console.log(err);
                process.exit();
            }

            const insertQuery = `
                INSERT INTO users
                (username, password, full_name, role)
                VALUES (?, ?, ?, ?)
            `;

            db.query(
                insertQuery,
                [
                    "admin2@gmail.com",
                    hashedPassword,
                    "Restaurant Admin",
                    "admin"
                ],
                (err) => {

                    if (err) {
                        console.log(err);
                    } else {
                        console.log("================================");
                        console.log("✅ Admin Created Successfully");
                        console.log("Username : admin2@gmail.com");
                        console.log("Password : Admin@123");
                        console.log("================================");
                    }

                    process.exit();

                }
            );

        });

    });

};

createAdmin();