/*
|--------------------------------------------------------------------------
| Tenant guard for routes that carry :restaurantId in the URL
|--------------------------------------------------------------------------
| Everywhere else the restaurant is read straight off the JWT and the request
| body/params are never trusted. A few older /api/system routes take the id in
| the path instead, which would let any logged-in user swap in another
| restaurant's id and read or overwrite its data.
|
| This keeps the URL shape (so existing callers don't break) but requires the
| id to be the caller's own. super_admin is exempt — it legitimately works
| across restaurants.
*/
const sameTenant = (req, res, next) => {
    if (req.user && req.user.role === "super_admin") return next();

    const asked = Number(req.params.restaurantId);
    const own = Number(req.user && req.user.restaurant_id);

    if (!own || !asked || asked !== own) {
        return res.status(403).json({
            success: false,
            message: "You are not authorized to access this restaurant's data."
        });
    }

    next();
};

module.exports = sameTenant;
