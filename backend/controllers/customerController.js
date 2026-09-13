const customerModel = require("../models/customerModel");
const { success, error } = require("../utils/response");

const MOBILE_RE = /^[0-9]{10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const GENDERS = ["Male", "Female", "Other"];

const text = (v) => (v == null ? "" : String(v).trim());

/*
| Validate and normalise a customer from a request body. Returns
| { customer } or { problem } with a message written for the person at the
| desk.
|
| MySQL runs strict, so an empty string is not "blank" to a DATE or ENUM column
| — it is a failed insert. Optional fields that were left empty become NULL.
*/
function readCustomer(body) {

    const name = text(body.customer_name);
    if (!name) return { problem: "Customer name is required." };
    if (name.length > 150) return { problem: "Customer name is too long." };

    const mobile = text(body.mobile);
    if (!MOBILE_RE.test(mobile)) return { problem: "Mobile number must be exactly 10 digits." };

    const email = text(body.email);
    if (email && (email.length > 100 || !EMAIL_RE.test(email))) {
        return { problem: "Enter a valid email address." };
    }

    const dob = text(body.date_of_birth).slice(0, 10);
    if (dob && !DATE_RE.test(dob)) return { problem: "Date of birth must be a valid date." };

    const gst = text(body.gst_number);
    if (gst.length > 30) return { problem: "GST number is too long." };

    return {
        customer: {
            customer_name: name,
            mobile,
            email: email || null,
            gender: GENDERS.includes(body.gender) ? body.gender : null,
            date_of_birth: dob || null,
            address: text(body.address) || null,
            gst_number: gst || null,
            status: body.status === "Inactive" ? "Inactive" : "Active"
        }
    };
}

// Get all customers
exports.getAllCustomers = (req, res) => {

    customerModel.getAllCustomers(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Customers fetched.", results);

    });

};

// Get customer by ID
exports.getCustomerById = (req, res) => {

    customerModel.getCustomerById(req.params.id, req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        if (results.length === 0) return error(res, "Customer not found.", 404);

        return success(res, "Customer fetched.", results[0]);

    });

};

// GET /api/customers/lookup?mobile=9876543210
// The front desk types a number; this says whether that customer has been in
// before. `data` is null when they haven't.
exports.lookupByMobile = (req, res) => {

    const mobile = text(req.query.mobile);
    if (!MOBILE_RE.test(mobile)) return error(res, "Mobile number must be exactly 10 digits.", 400);

    customerModel.findByMobile(req.user.restaurant_id, mobile, 0, (err, rows) => {

        if (err) return error(res, err.message, 500);

        return success(res, rows.length ? "Customer found." : "New customer.", rows[0] || null);

    });

};

// GET /api/customers/search?q=98765  or  ?q=ani
// Suggestions while the front desk types: at least 3 digits of a mobile number
// or 2 letters of a name, so a single keystroke doesn't list everyone.
exports.searchCustomers = (req, res) => {

    const term = text(req.query.q).slice(0, 50);
    const digits = /^[0-9]+$/.test(term);

    if (term.length < (digits ? 3 : 2)) {
        return success(res, "Keep typing.", []);
    }

    customerModel.searchCustomers(req.user.restaurant_id, term, (err, rows) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Customers found.", rows);

    });

};

// POST /api/customers/resolve  { customer_name, mobile }
// Used while billing: returns the customer with this mobile number, creating
// them first if they are new. Lets the bill carry a customer_id without the
// desk having to open a separate "add customer" form mid-queue.
exports.resolveCustomer = (req, res) => {

    const restaurantId = req.user.restaurant_id;
    const mobile = text(req.body.mobile);

    if (!MOBILE_RE.test(mobile)) return error(res, "Mobile number must be exactly 10 digits.", 400);

    customerModel.findByMobile(restaurantId, mobile, 0, (err, rows) => {

        if (err) return error(res, err.message, 500);

        if (rows.length) {
            return success(res, "Customer found.", { ...rows[0], is_new: false });
        }

        const { customer, problem } = readCustomer({ customer_name: req.body.customer_name, mobile });
        if (problem) return error(res, problem, 400);

        customerModel.createCustomer({ ...customer, restaurant_id: restaurantId }, (err, result) => {

            if (err) return error(res, err.message, 500);

            return success(res, "Customer added.", {
                id: result.insertId,
                customer_name: customer.customer_name,
                mobile: customer.mobile,
                is_new: true
            }, 201);

        });

    });

};

// Create customer
exports.createCustomer = (req, res) => {

    const restaurantId = req.user.restaurant_id;
    const { customer, problem } = readCustomer(req.body);
    if (problem) return error(res, problem, 400);

    customerModel.findByMobile(restaurantId, customer.mobile, 0, (err, rows) => {

        if (err) return error(res, err.message, 500);

        if (rows.length) {
            return error(res, `This mobile number already belongs to ${rows[0].customer_name}.`, 409);
        }

        customerModel.createCustomer({ ...customer, restaurant_id: restaurantId }, (err, result) => {

            if (err) return error(res, err.message, 500);

            return success(res, "Customer created successfully.", { id: result.insertId }, 201);

        });

    });

};

// Update customer
exports.updateCustomer = (req, res) => {

    const restaurantId = req.user.restaurant_id;
    const { customer, problem } = readCustomer(req.body);
    if (problem) return error(res, problem, 400);

    customerModel.findByMobile(restaurantId, customer.mobile, Number(req.params.id), (err, rows) => {

        if (err) return error(res, err.message, 500);

        if (rows.length) {
            return error(res, `This mobile number already belongs to ${rows[0].customer_name}.`, 409);
        }

        customerModel.updateCustomer(req.params.id, restaurantId, customer, (err, result) => {

            if (err) return error(res, err.message, 500);

            if (result.affectedRows === 0) return error(res, "Customer not found.", 404);

            return success(res, "Customer updated successfully.");

        });

    });

};

// GET /api/customers/:id/history — the customer's bills, newest first.
exports.getCustomerHistory = (req, res) => {

    const restaurantId = req.user.restaurant_id;

    customerModel.getCustomerById(req.params.id, restaurantId, (err, rows) => {

        if (err) return error(res, err.message, 500);
        if (rows.length === 0) return error(res, "Customer not found.", 404);

        customerModel.getCustomerHistory(req.params.id, restaurantId, (err, bills) => {

            if (err) return error(res, err.message, 500);

            return success(res, "Customer history fetched.", {
                customer: rows[0],
                bills
            });

        });

    });

};

// Delete customer
exports.deleteCustomer = (req, res) => {

    customerModel.deleteCustomer(req.params.id, req.user.restaurant_id, (err, result) => {

        if (err) return error(res, err.message, 500);

        if (result.affectedRows === 0) return error(res, "Customer not found.", 404);

        return success(res, "Customer deleted successfully.");

    });

};
