import React, { useEffect, useMemo, useState } from "react";

import AdminLayout from "../../layouts/AdminLayout";
import AddTableModal from "../../components/Admin/Tables/AddTableModal";
import EditTableModal from "../../components/Admin/Tables/EditTableModal";
import DeleteModal from "../../components/Admin/DeleteModal";

import TableStats from "../../components/Admin/Tables/TableStats";
import TableToolbar from "../../components/Admin/Tables/TableToolbar";
import TableGrid from "../../components/Admin/Tables/TableGrid";

import tableService from "../../services/tableService";

import "../../styles/Admin/Tables/Tables.css";

const Tables = () => {

    const [tables, setTables] = useState([]);
    const [stats, setStats] = useState({});

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    const [view, setView] = useState("grid");
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTable, setEditingTable] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingTable, setDeletingTable] = useState(null);

    useEffect(() => {

        loadTables();
        loadStats();

    }, []);

    const loadTables = async () => {

        try {

            const response = await tableService.getAllTables();

            setTables(response.data.data);

        } catch (error) {

            console.error(error);

        }

    };

    const loadStats = async () => {

        try {

            const response = await tableService.getDashboardStats();

            setStats(response.data.data);

        } catch (error) {

            console.error(error);

        }

    };

    const filteredTables = useMemo(() => {

        return tables.filter((table) => {

            const matchesSearch =
                table.table_name
                    .toLowerCase()
                    .includes(search.toLowerCase());

            const matchesStatus =
                statusFilter === "All"
                    ? true
                    : table.status === statusFilter;

            return matchesSearch && matchesStatus;

        });

    }, [tables, search, statusFilter]);

    const handleAddTable = () => {

    setShowAddModal(true);

};
const handleSaveTable = async (data) => {

    try {

        await tableService.createTable(data);

        setShowAddModal(false);

        loadTables();
        loadStats();

    } catch (error) {

        console.error(error);
        alert("Failed to create table.");

    }

};
const handleEditTable = (table) => {

    setEditingTable(table);
    setShowEditModal(true);

};

const handleUpdateTable = async (data) => {

    try {

        await tableService.updateTable(editingTable.id, data);

        setShowEditModal(false);
        setEditingTable(null);

        loadTables();
        loadStats();

    } catch (error) {

        console.error(error);
        alert("Failed to update table.");

    }

};

const handleDeleteTable = (table) => {

    setDeletingTable(table);
    setShowDeleteModal(true);

};

const handleConfirmDelete = async () => {

    if (!deletingTable) return;

    try {

        await tableService.deleteTable(deletingTable.id);

        setShowDeleteModal(false);
        setDeletingTable(null);

        loadTables();
        loadStats();

    } catch (error) {

        console.error(error);
        alert("Failed to delete table.");

    }

};
    return (

        <AdminLayout>

    <div className="tables-page">

        <div className="page-header">

            <div>

                <h2>Restaurant Tables</h2>

                <p>
                    Manage restaurant tables and monitor occupancy.
                </p>

            </div>

        </div>

        <TableStats stats={stats} />

        <TableToolbar
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            view={view}
            setView={setView}
            onAddTable={handleAddTable}
        />

        <TableGrid
            tables={filteredTables}
            view={view}
            onEdit={handleEditTable}
            onDelete={handleDeleteTable}
        />

    </div>
    <AddTableModal
    isOpen={showAddModal}
    onClose={() => setShowAddModal(false)}
    onSave={handleSaveTable}
/>
    {showEditModal && editingTable && (
    <EditTableModal
    table={editingTable}
    onClose={() => setShowEditModal(false)}
    onSave={handleUpdateTable}
/>
    )}

    <DeleteModal
    open={showDeleteModal}
    title="Delete Table"
    message={
        deletingTable
            ? `Are you sure you want to delete ${deletingTable.table_name}? This cannot be undone.`
            : ""
    }
    onCancel={() => setShowDeleteModal(false)}
    onDelete={handleConfirmDelete}
/>

</AdminLayout>

    );

};

export default Tables;