/*
|--------------------------------------------------------------------------
| Business types
|--------------------------------------------------------------------------
| A tenant is either a restaurant or a salon. The super admin picks it when the
| business is created and it is never changed afterwards — a restaurant's
| tables / KOT history and a salon's customers / stock don't translate into
| each other, so switching would leave a tenant with data its panel can't show.
|
| The tenant table and every foreign key are still called `restaurants` /
| `restaurant_id`. Renaming them would break the sync engine and every till
| already installed, so "restaurant" in a column name means "business".
*/

const BUSINESS_TYPES = ["restaurant", "salon"];
const DEFAULT_BUSINESS_TYPE = "restaurant";

// Anything missing or unknown — a row or a token from before business types
// existed — is a restaurant, which is what every existing tenant is.
const normalizeBusinessType = (value) =>
    BUSINESS_TYPES.includes(value) ? value : DEFAULT_BUSINESS_TYPE;

const isSalon = (user) =>
    normalizeBusinessType(user && user.business_type) === "salon";

module.exports = {
    BUSINESS_TYPES,
    DEFAULT_BUSINESS_TYPE,
    normalizeBusinessType,
    isSalon
};
