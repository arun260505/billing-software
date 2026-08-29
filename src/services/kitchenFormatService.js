import api from "./api";

const getKitchenFormat = () => api.get("/kitchen-format");
const saveKitchenFormat = (data) => api.put("/kitchen-format", data);

const kitchenFormatService = {
    getKitchenFormat,
    saveKitchenFormat
};

export default kitchenFormatService;
