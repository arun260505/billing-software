/*
|--------------------------------------------------------------------------
| Sync table registry
|--------------------------------------------------------------------------
| One place that describes, for every syncable table:
|   - direction: "up"   = restaurant-owned, pushed restaurant -> cloud
|                "down" = admin-owned, pulled cloud -> restaurant
|   - fks: foreign-key column -> the table it points at.
|
| Rows are identified across databases by `uuid` (see migrations/syncColumns.js).
| Because each database keeps its own INT primary keys, every foreign key must
| be translated on transfer: the sender emits the PARENT's uuid, the receiver
| resolves it back to its own local INT id. So sync must process tables in
| dependency order (parents before children) — hence the array order below.
*/

// Ordered parents-first so a child's FK parents always exist on the receiver.
const SYNC_ORDER = [
    { table: "restaurants",     direction: "down", fks: {} },
    { table: "categories",      direction: "down", fks: { restaurant_id: "restaurants" } },
    { table: "customers",       direction: "up",   fks: { restaurant_id: "restaurants" } },
    // Tables are managed centrally (admin) and pulled down, so a fresh node
    // inherits them. Occupancy status is set locally and simply isn't pushed up.
    { table: "dining_tables",   direction: "down", fks: { restaurant_id: "restaurants" } },
    { table: "roles",           direction: "down", fks: { restaurant_id: "restaurants" } },
    { table: "settings",        direction: "down", fks: { restaurant_id: "restaurants" } },
    // Enabled payment methods + the default method: owner config, flows cloud -> till.
    { table: "payment_settings", direction: "down", fks: { restaurant_id: "restaurants" } },
    { table: "charges",         direction: "down", fks: { restaurant_id: "restaurants" } },
    { table: "bill_formats",    direction: "down", fks: { restaurant_id: "restaurants" } },
    { table: "kitchen_formats", direction: "down", fks: { restaurant_id: "restaurants" } },
    // keepLocal: the printers are chosen on the till they're plugged into and
    // never exist on the cloud, so a pull must not overwrite them with the cloud
    // row's empty values (it did — changing the printer setup online, or
    // re-activating a till, wiped the till's saved printers). The mode and the
    // waiter toggle still come from the cloud.
    { table: "printer_settings", direction: "down", fks: { restaurant_id: "restaurants" }, keepLocal: ["cashier_printer", "kitchen_printer"] },
    // Order-number FORMAT flows cloud -> till (owner config). keepLocal on the
    // running counter, so a pull carries prefix/start/digits/reset_mode but never
    // overwrites the till's own current_sequence — each till advances its own run
    // of numbers, and the cloud's copy stays whatever it last issued.
    { table: "order_number_settings", direction: "down", fks: { restaurant_id: "restaurants" }, keepLocal: ["current_sequence", "sequence_reset_key"] },
    // Salon stock, kept by the owner like the menu, so it flows cloud -> till.
    // Pulled BEFORE menu_items so a sellable item's mirror menu_item can point
    // back at it (menu_items.inventory_item_id).
    { table: "inventory_items",     direction: "down", fks: { restaurant_id: "restaurants", category_id: "categories" } },
    { table: "menu_items",      direction: "down", fks: { restaurant_id: "restaurants", category_id: "categories", inventory_item_id: "inventory_items" } },
    { table: "users",           direction: "down", fks: { restaurant_id: "restaurants", created_by: "users" } },
    // stylist_id (014) points at users, which a till already has from the pull.
    { table: "orders",          direction: "up",   fks: { restaurant_id: "restaurants", customer_id: "customers", table_id: "dining_tables", stylist_id: "users", employee_id: "users" } },
    { table: "order_items",     direction: "up",   fks: { order_id: "orders", menu_item_id: "menu_items" } },
    { table: "payments",        direction: "up",   fks: { restaurant_id: "restaurants", order_id: "orders" } },
    // Day close / cash-up snapshots: written at the till, pushed up for reports.
    { table: "day_closures",    direction: "up",   fks: { restaurant_id: "restaurants", opened_by: "users", closed_by: "users" } },
    // Stock movements last (down): reference inventory_items (pulled above).
    { table: "inventory_movements", direction: "down", fks: { restaurant_id: "restaurants", inventory_item_id: "inventory_items", created_by: "users" } },
    // Owner alerts (up): raised at the till, pulled into the cloud for the owner's
    // phone app. Only a restaurant FK, so they never wait on another table.
    { table: "notifications", direction: "up", fks: { restaurant_id: "restaurants" } }
];

const BY_TABLE = Object.fromEntries(SYNC_ORDER.map((t) => [t.table, t]));

const UP_TABLES = SYNC_ORDER.filter((t) => t.direction === "up").map((t) => t.table);
const DOWN_TABLES = SYNC_ORDER.filter((t) => t.direction === "down").map((t) => t.table);

// UP tables carry synced_at; DOWN tables do not.
module.exports = { SYNC_ORDER, BY_TABLE, UP_TABLES, DOWN_TABLES };
