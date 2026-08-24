import api from "./api";

const getBillingFormat = () => api.get("/billing/format");
const saveBillingFormat = (data) => api.put("/billing/format", data);
const updateRestaurantDetails = (data) => api.put("/billing/restaurant", data);

const billingFormatService = {
    getBillingFormat,
    saveBillingFormat,
    updateRestaurantDetails
};

export default billingFormatService;
