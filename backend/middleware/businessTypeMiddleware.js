const { normalizeBusinessType } = require("../utils/businessType");

/*
| Routes that only make sense for one kind of business.
|
| The salon panel never links to tables, KOT or the kitchen, but a hidden menu
| link is not a permission: a salon login could still call /api/tables by hand.
| These refuse it. The type comes from the JWT, which authModel fills from the
| restaurants row at login — never from the request. Must run after
| authMiddleware.
*/
const onlyFor = (type) => (req, res, next) => {

    if (normalizeBusinessType(req.user && req.user.business_type) === type) {
        return next();
    }

    return res.status(403).json({
        success: false,
        message: type === "salon"
            ? "This feature is only available for salons."
            : "This feature is only available for restaurants."
    });

};

module.exports = {
    restaurantOnly: onlyFor("restaurant"),
    salonOnly: onlyFor("salon")
};
