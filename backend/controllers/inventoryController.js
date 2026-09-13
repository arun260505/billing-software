const inventoryModel = require("../models/inventoryModel");
const { success, error } = require("../utils/response");

const text = (v) => (v == null ? "" : String(v).trim());

// A non-negative number, or null when the value isn't one.
const nonNegative = (v, fallback = 0) => {
    if (v === "" || v === null || v === undefined) return fallback;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

// Validate an item from the request body. Returns { item } or { problem }.
// `withQuantity` is only true on create — after that, stock moves through
// POST /:id/stock so every change is logged.
function readItem(body, { withQuantity }) {

    const name = text(body.item_name);
    if (!name) return { problem: "Item name is required." };
    if (name.length > 150) return { problem: "Item name is too long." };

    const sku = text(body.sku);
    if (sku.length > 60) return { problem: "SKU / code is too long." };

    const category = text(body.category);
    if (category.length > 100) return { problem: "Category is too long." };

    const unit = text(body.unit) || "pcs";
    if (unit.length > 20) return { problem: "Unit is too long." };

    const minQuantity = nonNegative(body.min_quantity);
    if (minQuantity === null) return { problem: "Reorder level must be 0 or more." };

    const costPrice = nonNegative(body.cost_price);
    if (costPrice === null) return { problem: "Cost price must be 0 or more." };

    const item = {
        item_name: name,
        sku: sku || null,
        category: category || null,
        unit,
        min_quantity: minQuantity,
        cost_price: costPrice,
        status: body.status === "Inactive" ? "Inactive" : "Active"
    };

    if (withQuantity) {
        const quantity = nonNegative(body.quantity);
        if (quantity === null) return { problem: "Opening stock must be 0 or more." };
        item.quantity = quantity;
    }

    return { item };
}

exports.getItems = async (req, res) => {
    try {
        const items = await inventoryModel.list(req.user.restaurant_id);
        return success(res, "Inventory fetched.", items);
    } catch (e) {
        return error(res, e.message, 500);
    }
};

exports.getSummary = async (req, res) => {
    try {
        const summary = await inventoryModel.summary(req.user.restaurant_id);
        return success(res, "Inventory summary fetched.", summary);
    } catch (e) {
        return error(res, e.message, 500);
    }
};

exports.createItem = async (req, res) => {
    const { item, problem } = readItem(req.body, { withQuantity: true });
    if (problem) return error(res, problem, 400);

    try {
        const id = await inventoryModel.create(req.user.restaurant_id, item, req.user.id);
        return success(res, "Item added to inventory.", { id }, 201);
    } catch (e) {
        return error(res, e.message, 500);
    }
};

exports.updateItem = async (req, res) => {
    const { item, problem } = readItem(req.body, { withQuantity: false });
    if (problem) return error(res, problem, 400);

    try {
        const changed = await inventoryModel.update(req.params.id, req.user.restaurant_id, item);
        if (!changed) return error(res, "Item not found.", 404);
        return success(res, "Item updated.");
    } catch (e) {
        return error(res, e.message, 500);
    }
};

exports.deleteItem = async (req, res) => {
    try {
        const changed = await inventoryModel.remove(req.params.id, req.user.restaurant_id);
        if (!changed) return error(res, "Item not found.", 404);
        return success(res, "Item removed from inventory.");
    } catch (e) {
        return error(res, e.message, 500);
    }
};

// POST /api/inventory/:id/stock  { movement_type: In|Out|Adjust, quantity, note }
exports.moveStock = async (req, res) => {

    const type = req.body.movement_type;
    if (!inventoryModel.MOVEMENT_TYPES.includes(type)) {
        return error(res, "Choose Stock In, Stock Out or Adjust.", 400);
    }

    const quantity = nonNegative(req.body.quantity, null);
    if (quantity === null) return error(res, "Enter a valid quantity.", 400);
    if (type !== "Adjust" && quantity <= 0) return error(res, "Quantity must be more than 0.", 400);

    const note = text(req.body.note);
    if (note.length > 255) return error(res, "Note is too long.", 400);

    try {
        const result = await inventoryModel.adjustStock(
            req.params.id,
            req.user.restaurant_id,
            { movement_type: type, quantity, note },
            req.user.id
        );
        if (result.notFound) return error(res, "Item not found.", 404);
        if (result.problem) return error(res, result.problem, 400);
        return success(res, "Stock updated.", result.item);
    } catch (e) {
        return error(res, e.message, 500);
    }
};

exports.getMovements = async (req, res) => {
    try {
        const rows = await inventoryModel.movements(
            req.user.restaurant_id,
            req.params.id ? Number(req.params.id) : null,
            req.query.limit
        );
        return success(res, "Stock movements fetched.", rows);
    } catch (e) {
        return error(res, e.message, 500);
    }
};
