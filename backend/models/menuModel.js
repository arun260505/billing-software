const db = require("../config/db");

const timingAvailabilitySql = `
    CASE
        WHEN c.start_time IS NULL OR c.end_time IS NULL THEN 1
        WHEN c.start_time = c.end_time THEN 1
        WHEN c.start_time < c.end_time
            THEN CURTIME() BETWEEN c.start_time AND c.end_time
        ELSE
            CURTIME() >= c.start_time OR CURTIME() <= c.end_time
    END
`;

const effectiveAvailabilitySql = `
    CASE
        WHEN m.available = 1
         AND c.status = 'Active'
         AND (${timingAvailabilitySql}) = 1
            THEN 1
        ELSE 0
    END
`;

// Get All Menu Items (tenant-scoped)
exports.getAllMenuItems = (restaurantId, callback) => {

    const sql = `
        SELECT
            m.*,
            c.category_name,
            c.start_time,
            c.end_time,
            (${timingAvailabilitySql}) AS is_category_timing_active,
            (${effectiveAvailabilitySql}) AS effective_available
        FROM menu_items m
        JOIN categories c
            ON m.category_id = c.id
        WHERE m.restaurant_id = ? AND m.deleted_at IS NULL
        ORDER BY m.display_order ASC, m.item_name ASC
    `;

    db.query(sql, [restaurantId], callback);

};

// Summary (tenant-scoped)
exports.getSummary = (restaurantId, callback) => {

    const sql = `
        SELECT
            COUNT(*) AS totalItems,
            COALESCE(SUM((${effectiveAvailabilitySql}) = 1), 0) AS availableItems,
            COALESCE(SUM(is_best_seller = 1), 0) AS bestSellerItems,
            COALESCE(SUM(is_today_special = 1), 0) AS todaySpecialItems
        FROM menu_items m
        INNER JOIN categories c ON m.category_id = c.id
        WHERE m.restaurant_id = ? AND m.deleted_at IS NULL
    `;

    db.query(sql, [restaurantId], callback);

};

/*
| MySQL runs with STRICT_TRANS_TABLES, so an empty string is not a soft "leave
| it blank" — it is a hard error against a typed column:
|
|   kitchen_section  enum('Kitchen','Bar','Bakery')  ->  "Data truncated"
|   preparation_time int                             ->  "Incorrect integer value"
|   item_code        varchar UNIQUE                   ->  "" is a real value, so a
|                                                        SECOND blank code is a
|                                                        duplicate-key error
|
| The admin form sends "" for anything the user left alone, which is why adding
| a menu item failed with a generic "Something went wrong". Normalising here
| covers every caller — the add form, the edit form and the cloud sync — rather
| than trusting each one to send the right empty value.
*/
const KITCHEN_SECTIONS = ["Kitchen", "Bar", "Bakery"];
const FOOD_TYPES = ["Veg", "Egg", "NonVeg"];

// "" / undefined -> null, so MySQL stores NULL instead of rejecting the row.
const orNull = (v) => (v === "" || v === undefined ? null : v);

// An integer column: keep real numbers, send NULL for anything else.
const orNullInt = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
};

// An enum column: only the values the column actually allows; anything else
// falls back to the column's own default rather than failing the insert.
const enumOr = (v, allowed, fallback) =>
    allowed.includes(v) ? v : fallback;

function normalizeMenuItem(data) {
    return {
        ...data,
        item_code: orNull(data.item_code),
        description: orNull(data.description),
        image: orNull(data.image),
        price: orNullInt(data.price) === null ? null : Number(data.price),
        gst: data.gst === "" || data.gst == null ? null : Number(data.gst),
        preparation_time: orNullInt(data.preparation_time),
        display_order: orNullInt(data.display_order),
        kitchen_section: enumOr(data.kitchen_section, KITCHEN_SECTIONS, "Kitchen"),
        food_type: enumOr(data.food_type, FOOD_TYPES, "Veg")
    };
}

// Add Menu Item (restaurant_id from caller)
exports.addMenuItem = (raw, callback) => {

    const data = normalizeMenuItem(raw);

    const sql = `
        INSERT INTO menu_items
        (
            restaurant_id,
            category_id,
            item_name,
            item_code,
            price,
            gst,
            kitchen_section,
            food_type,
            available,
            description,
            preparation_time,
            display_order,
            is_today_special,
            is_best_seller,
            is_new_item,
            is_seasonal,
            image
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        data.restaurant_id,
        data.category_id,
        data.item_name,
        data.item_code,
        data.price,
        data.gst,
        data.kitchen_section,
        data.food_type,
        data.available,
        data.description,
        data.preparation_time,
        data.display_order,
        data.is_today_special,
        data.is_best_seller,
        data.is_new_item,
        data.is_seasonal,
        data.image
    ], callback);

};

// Update Menu Item (tenant-scoped)
exports.updateMenuItem = (id, restaurantId, raw, callback) => {

    // Same empty-string problem as the insert — editing an item and leaving an
    // optional field blank would fail the same way.
    const data = normalizeMenuItem(raw);

    const sql = `
        UPDATE menu_items
        SET
            category_id=?,
            item_name=?,
            item_code=?,
            price=?,
            gst=?,
            kitchen_section=?,
            food_type=?,
            available=?,
            description=?,
            preparation_time=?,
            display_order=?,
            is_today_special=?,
            is_best_seller=?,
            is_new_item=?,
            is_seasonal=?,
            image=?
        WHERE id=? AND restaurant_id=?
    `;

    db.query(sql, [
        data.category_id,
        data.item_name,
        data.item_code,
        data.price,
        data.gst,
        data.kitchen_section,
        data.food_type,
        data.available,
        data.description,
        data.preparation_time,
        data.display_order,
        data.is_today_special,
        data.is_best_seller,
        data.is_new_item,
        data.is_seasonal,
        data.image,
        id,
        restaurantId
    ], callback);

};

// Delete Menu Item (tenant-scoped)
exports.deleteMenuItem = (id, restaurantId, callback) => {

    // Soft delete so the removal syncs to the cloud.
    db.query(
        "UPDATE menu_items SET deleted_at = NOW() WHERE id=? AND restaurant_id=? AND deleted_at IS NULL",
        [id, restaurantId],
        callback
    );

};

// ---------------------------------------------------------------------------
// Waiter ordering support (tenant-scoped)
// ---------------------------------------------------------------------------

// Active categories for the order screen
exports.getMenuCategories = (restaurantId, callback) => {

    const sql = `
        SELECT c.id, c.category_name, c.status
             , c.start_time
             , c.end_time
             , (${timingAvailabilitySql}) AS is_currently_available
        FROM categories c
        WHERE c.restaurant_id = ?
          AND c.status = 'Active'
          AND c.deleted_at IS NULL
        ORDER BY c.category_name ASC
    `;

    db.query(sql, [restaurantId], callback);

};

// Items in the shape the waiter UI expects (available_quantity + category_name)
exports.getWaiterItems = (restaurantId, callback) => {

    const sql = `
        SELECT
            m.id,
            m.item_name,
            m.price,
            m.gst,
            m.food_type,
            m.description,
            (${effectiveAvailabilitySql}) AS available_quantity,
            c.category_name,
            c.start_time,
            c.end_time,
            (${timingAvailabilitySql}) AS is_category_timing_active
        FROM menu_items m
        INNER JOIN categories c ON m.category_id = c.id
        WHERE m.restaurant_id = ? AND m.deleted_at IS NULL
        ORDER BY m.item_name ASC
    `;

    db.query(sql, [restaurantId], callback);

};

// Toggle an item's availability (tenant-scoped) — cashier/admin.
exports.setAvailability = (id, restaurantId, available, callback) => {

    db.query(
        "UPDATE menu_items SET available=? WHERE id=? AND restaurant_id=?",
        [available ? 1 : 0, id, restaurantId],
        callback
    );

};

// Items for one category (tenant-scoped)
exports.getWaiterItemsByCategory = (categoryId, restaurantId, callback) => {

    const sql = `
        SELECT
            m.id,
            m.item_name,
            m.price,
            m.gst,
            m.food_type,
            m.description,
            (${effectiveAvailabilitySql}) AS available_quantity,
            c.category_name,
            c.start_time,
            c.end_time,
            (${timingAvailabilitySql}) AS is_category_timing_active
        FROM menu_items m
        INNER JOIN categories c ON m.category_id = c.id
        WHERE m.category_id = ? AND m.restaurant_id = ? AND m.deleted_at IS NULL
        ORDER BY m.item_name ASC
    `;

    db.query(sql, [categoryId, restaurantId], callback);

};
