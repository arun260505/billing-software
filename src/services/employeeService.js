import axios from "axios";

const API = "http://localhost:5000/api/employees";

const getEmployees = () => {
    return axios.get(API);
};

const getSummary = () => {
    return axios.get(`${API}/summary`);
};
const addEmployee = async (data) => {

    const response = await axios.post(API, data);

    return response.data;

};

const updateEmployee = (id, data) => {
    return axios.put(`${API}/${id}`, data);
};

const deleteEmployee = (id) => {
    return axios.delete(`${API}/${id}`);
};

const employeeService = {
    getEmployees,
    getSummary,
    addEmployee,
    updateEmployee,
    deleteEmployee
};

export default employeeService;