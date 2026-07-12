import api from "./api";

const login = async (loginData) => {

    const response = await api.post("/auth/login", loginData);

    return response.data;

};

const logout = () => {

    localStorage.removeItem("token");
    localStorage.removeItem("user");

};

const authService = {
    login,
    logout
};

export default authService;