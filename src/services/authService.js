import api from "./api";

const login = async (loginData) => {

    const response = await api.post("/auth/login", loginData);

    return response.data;

};

const logout = () => {

    localStorage.removeItem("token");
    localStorage.removeItem("user");

};

const getToken = () => {

    return localStorage.getItem("token");

};

const getUser = () => {

    const raw = localStorage.getItem("user");

    // Guard against null and the literal string "undefined" (which
    // JSON.parse would throw on with '"undefined" is not valid JSON').
    if (!raw || raw === "undefined" || raw === "null") {
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }

};

const isAuthenticated = () => {

    return Boolean(getToken()) && Boolean(getUser());

};

const authService = {
    login,
    logout,
    getToken,
    getUser,
    isAuthenticated
};

export default authService;