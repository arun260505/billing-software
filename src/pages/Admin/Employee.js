import React, { useEffect, useState } from "react";
import EmployeeModal from "../../components/Admin/EmployeeModal";

import Sidebar from "../../components/Admin/Sidebar";
import Header from "../../components/Admin/Header";

import EmployeeCards from "../../components/Admin/EmployeeCards";
import EmployeeFilters from "../../components/Admin/EmployeeFilters";
import EmployeeTable from "../../components/Admin/EmployeeTable";

import employeeService from "../../services/employeeService";
import EmployeeSuccessModal from "../../components/Admin/EmployeeSuccessModal";

import "../../styles/Admin/Dashboard.css";
import "../../styles/Admin/Employee.css";

function Employee() {


    const [employees, setEmployees] = useState([]);
    const [summary, setSummary] = useState({});
    const [showModal, setShowModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
const [credentials, setCredentials] = useState(null);

useEffect(() => {
    console.log("showModal:", showModal);
}, [showModal]);

    useEffect(() => {

        loadEmployees();
        loadSummary();

    }, []);

    const loadEmployees = () => {

        employeeService.getEmployees()

            .then((res) => {

                setEmployees(res.data);

            })

            .catch((err) => {

                console.log(err);

            });

    };
  const handleAddEmployee = async (form) => {

    try {

        const response = await employeeService.addEmployee(form);

        setCredentials({
            full_name: form.full_name,
            username: response.credentials.username,
            password: response.credentials.password
        });

        setShowModal(false);

        setShowSuccessModal(true);

        loadEmployees();

        loadSummary();

    } catch (err) {

        console.error(err);

        alert("Failed to create employee.");

    }

};

    const loadSummary = () => {

        employeeService.getSummary()

            .then((res) => {

                setSummary(res.data);

            })

            .catch((err) => {

                console.log(err);

            });

    };

    return (

        <div className="dashboard-container">

            <Sidebar />

            <div className="dashboard-main">

                <Header />

                <div className="dashboard-content">

                    <div className="page-header">

                        <h2>Employee Management</h2>

                        <p>Manage restaurant employees efficiently.</p>

                    </div>
                    <EmployeeCards summary={summary} />

<EmployeeFilters
    onAdd={() => setShowModal(true)}
/>

<EmployeeTable
    employees={employees}
/>

<EmployeeModal
    show={showModal}
    onClose={() => setShowModal(false)}
    onSave={handleAddEmployee}
/>
<EmployeeSuccessModal
    show={showSuccessModal}
    credentials={credentials}
    onClose={() => setShowSuccessModal(false)}
/>



                </div>

            </div>

        </div>

    );

}

export default Employee;