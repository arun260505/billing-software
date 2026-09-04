const { GENERIC_500 } = require("../utils/response");

/*
| Last-resort handler for anything a route threw without catching.
|
| The full error (stack included) goes to the server log; the client gets a
| sentence. An error carrying an explicit 4xx status was raised deliberately by
| our own code and its message is meant to be read, so that one is passed on.
| Set SHOW_INTERNAL_ERRORS=true in backend/.env to see the detail in responses
| while developing.
*/
const errorHandler = (err, req, res, next) => {

    console.error(err);

    const status = err.status || 500;
    const showInternal = process.env.SHOW_INTERNAL_ERRORS === "true";
    const isClientError = status >= 400 && status < 500;

    res.status(status).json({
        success: false,
        message: (isClientError || showInternal)
            ? (err.message || GENERIC_500)
            : GENERIC_500
    });

};

module.exports = errorHandler;
