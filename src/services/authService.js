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

    const user = localStorage.getItem("user");

    return user ? JSON.parse(user) : null;

};

const authService = {
    login,
    logout,
    getToken,
    getUser
};

export default authService;