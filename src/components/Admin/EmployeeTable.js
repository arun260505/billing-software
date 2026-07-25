import React from "react";
import { FaEye, FaEdit, FaTrash } from "react-icons/fa";

function EmployeeTable({ employees }) {

    return (

        <div className="employee-table">

            <table>

                <thead>

                    <tr>

                        <th>ID</th>
                        <th>Employee</th>
                        <th>Role</th>
                        <th>Mobile</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th>Actions</th>

                    </tr>

                </thead>

                <tbody>

                    {

                        employees.length > 0 ? (

                            employees.map((employee) => (

                                <tr key={employee.id}>

                                    <td>{employee.id}</td>

                                    <td>

                                        <div className="employee-info">

                                            <div className="employee-avatar">

                                                {employee.full_name.charAt(0)}

                                            </div>

                                            <span>{employee.full_name}</span>

                                        </div>

                                    </td>

                                    <td>{employee.role}</td>

                                    <td>{employee.mobile}</td>

                                    <td>{employee.email}</td>

                                    <td>

                                        <span
                                            className={
                                                employee.status === "Active"
                                                    ? "status active"
                                                    : "status inactive"
                                            }
                                        >

                                            {employee.status}

                                        </span>

                                    </td>

                                    <td>

                                        {new Date(employee.created_at).toLocaleDateString()}

                                    </td>

                                    <td>

                                        <button className="action-btn view">

                                            <FaEye />

                                        </button>

                                        <button className="action-btn edit">

                                            <FaEdit />

                                        </button>

                                        <button className="action-btn delete">

                                            <FaTrash />

                                        </button>

                                    </td>

                                </tr>

                            ))

                        ) : (

                            <tr>

                                <td colSpan="8">

                                    <div className="empty-state">

                                        <h3>No Employees Found</h3>

                                        <p>

                                            Click <strong>+ Add Employee</strong> to create your first employee.

                                        </p>

                                    </div>

                                </td>

                            </tr>

                        )

                    }

                </tbody>

            </table>

        </div>

    );

}

export default EmployeeTable;