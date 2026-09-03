import api from "./api";

const getPrinterSetting = () => api.get("/printer-settings");

// Admin only — changes which printer setup the restaurant runs.
const savePrinterSetting = (data) => api.put("/printer-settings", data);

// Cashier (or admin) — records which physical printers this till uses.
const savePrinterDevices = (data) => api.put("/printer-settings/devices", data);

const printerSettingService = {
    getPrinterSetting,
    savePrinterSetting,
    savePrinterDevices
};

export default printerSettingService;
