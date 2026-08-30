require("dotenv").config();

const bcrypt = require("bcryptjs");
const db = require("../config/db");

const createSuperAdmin = async () => {
    try {

        const checkQuery = "SELECT * FROM users WHERE role = ?";

        db.query(checkQuery, ["super_admin"], async (err, result) => {

            if (err) {
                console.log(err);
                process.exit();
            }

            if (result.length > 0) {
                console.log("✅ Super Admin already exists.");
                process.exit();
            }

            const hashedPassword = await bcrypt.hash("Admin@123", 10);

            const insertQuery = `
                INSERT INTO users
                (username,password,full_name,role)
                VALUES (?,?,?,?)
            `;

            db.query(
                insertQuery,
                [
                    "inwallz",
                    hashedPassword,
                    "InWallz Super Admin",
                    "super_admin"
                ],
                (err) => {

                    if (err) {
                        console.log(err);
                    } else {
                        console.log("✅ Super Admin Created Successfully");
                        console.log("--------------------------------");
                        console.log("Username : inwallz");
                        console.log("Password : Admin@123");
                        console.log("--------------------------------");
                    }

                    process.exit();

                }
            );

        });

    } catch (error) {

        console.log(error);

    }
};

createSuperAdmin();