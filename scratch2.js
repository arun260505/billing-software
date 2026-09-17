require('dotenv').config({ path: './backend/.env' });
const dashboardModel = require('./backend/models/dashboardModel');
dashboardModel.getSummary(1, (err, result) => {
    if (err) {
        console.error("ERROR:", err);
    } else {
        console.log("SUMMARY RESULT:", result[0]);
    }
    process.exit();
});
