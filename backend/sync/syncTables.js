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
    { table: "charges",         direction: "down", fks: { restaurant_id: "restaurants" } },
    { table: "bill_formats",    direction: "down", fks: { restaurant_id: "restaurants" } },
    { table: "kitchen_formats", direction: "down", fks: { restaurant_id: "restaurants" } },
    { table: "menu_items",      direction: "down", fks: { restaurant_id: "restaurants", category_id: "categories" } },
    { table: "users",           direction: "down", fks: { restaurant_id: "restaurants", created_by: "users" } },
    { table: "orders",          direction: "up",   fks: { restaurant_id: "restaurants", customer_id: "customers", table_id: "dining_tables" } },
    { table: "order_items",     direction: "up",   fks: { order_id: "orders", menu_item_id: "menu_items" } },
    { table: "payments",        direction: "up",   fks: { restaurant_id: "restaurants", order_id: "orders" } }
];

const BY_TABLE = Object.fromEntries(SYNC_ORDER.map((t) => [t.table, t]));

const UP_TABLES = SYNC_ORDER.filter((t) => t.direction === "up").map((t) => t.table);
const DOWN_TABLES = SYNC_ORDER.filter((t) => t.direction === "down").map((t) => t.table);

// UP tables carry synced_at; DOWN tables do not.
module.exports = { SYNC_ORDER, BY_TABLE, UP_TABLES, DOWN_TABLES };
