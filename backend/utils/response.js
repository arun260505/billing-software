// utils/response.js

/*
| Controllers overwhelmingly report failures as `error(res, err.message, 500)`,
| which sends the raw driver text straight to the caller — "Unknown column
| 'o.foo' in 'field list'", table names, and so on. That is a free map of the
| schema for anyone poking the API, and it means nothing to a cashier.
|
| So: a 500 answers with a flat sentence and the real message goes to the
| server log instead. Deliberate 4xx messages ("Menu item not found on this
| menu.", "Table is already billed.") are written FOR the user, so they pass
| through untouched.
|
| SHOW_INTERNAL_ERRORS=true in backend/.env puts the detail back in the
| response while working on a dev machine.
*/

const GENERIC_500 = "Something went wrong. Please try again.";

const showInternal = () => process.env.SHOW_INTERNAL_ERRORS === "true";

const success = (res, message = "Success", data = null, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

const error = (res, message = "Something went wrong", statusCode = 500, errors = null) => {

    const internal = statusCode >= 500;

    if (internal) {
        console.error(`[${statusCode}] ${message}`);
    }

    return res.status(statusCode).json({
        success: false,
        message: internal && !showInternal() ? GENERIC_500 : message,
        errors
    });
};

module.exports = {
    success,
    error,
    GENERIC_500
};
