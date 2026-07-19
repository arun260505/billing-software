const Table = require("../models/Table");

// GET /api/tables
exports.getTables = (req, res) => {

    Table.getAll((err, results) => {

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

    });

};

// GET /api/tables/:id
exports.getTableById = (req, res) => {

    const { id } = req.params;

    Table.getById(id, (err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Table not found"
            });
        }

        res.json({
            success: true,
            data: results[0]
        });

    });

};

// PUT /api/tables/:id/status
exports.updateTableStatus = (req, res) => {

    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["FREE", "OCCUPIED"].includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid status. Must be FREE or OCCUPIED"
        });
    }

    Table.updateStatus(id, status, (err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Table not found"
            });
        }

        res.json({
            success: true,
            message: `Table status updated to ${status}`
        });

    });

};
