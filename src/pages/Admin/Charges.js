import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "../../layouts/AdminLayout";
import chargeService from "../../services/chargeService";
import ChargeCards from "../../components/Admin/Charges/ChargeCards";
import ChargeFilters from "../../components/Admin/Charges/ChargeFilters";
import ChargeTable from "../../components/Admin/Charges/ChargeTable";
import ChargeModal from "../../components/Admin/Charges/ChargeModal";
import DeleteChargeModal from "../../components/Admin/Charges/DeleteChargeModal";
import MenuPricingSection from "../../components/Admin/Charges/MenuPricingSection";

import "../../styles/Admin/Dashboard.css";
import "../../styles/Admin/Charges.css";

function Charges() {

    const [charges, setCharges] = useState([]);
    const [summary, setSummary] = useState({});
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("All");
    const [appliesFilter, setAppliesFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState("updated_at");
    const [sortDir, setSortDir] = useState("desc");
    const [showModal, setShowModal] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [selectedCharge, setSelectedCharge] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const itemsPerPage = 10;

    useEffect(() => {
        loadCharges();
        loadSummary();
    }, []);

    const loadCharges = async () => {
        try {
            const res = await chargeService.getCharges();
            setCharges(res.data.data || []);
        } catch (err) {
            console.error("Failed to load charges:", err);
        }
    };

    const loadSummary = async () => {
        try {
            const res = await chargeService.getSummary();
            setSummary(res.data.data || {});
        } catch (err) {
            console.error("Failed to load summary:", err);
        }
    };

    const filteredCharges = useMemo(() => {
        let list = [...charges];

        if (search) {
            const q = search.toLowerCase();
            list = list.filter(
                (c) =>
                    c.charge_name.toLowerCase().includes(q) ||
                    (c.description && c.description.toLowerCase().includes(q))
            );
        }

        if (typeFilter !== "All") {
            list = list.filter((c) => c.charge_type === typeFilter);
        }

        if (appliesFilter !== "All") {
            list = list.filter((c) => {
                if (appliesFilter === "Dine-in") return c.applies_dinein;
                if (appliesFilter === "Takeaway") return c.applies_takeaway;
                if (appliesFilter === "Delivery") return c.applies_delivery;
                return true;
            });
        }

        if (statusFilter !== "All") {
            list = list.filter((c) => c.status === statusFilter);
        }

        list.sort((a, b) => {
            let va = a[sortField];
            let vb = b[sortField];
            if (sortField === "amount") {
                va = Number(va);
                vb = Number(vb);
            } else if (sortField === "updated_at") {
                va = new Date(va || 0).getTime();
                vb = new Date(vb || 0).getTime();
            } else {
                va = String(va || "").toLowerCase();
                vb = String(vb || "").toLowerCase();
            }
            if (va < vb) return sortDir === "asc" ? -1 : 1;
            if (va > vb) return sortDir === "asc" ? 1 : -1;
            return 0;
        });

        return list;
    }, [charges, search, typeFilter, appliesFilter, statusFilter, sortField, sortDir]);

    const totalPages = Math.ceil(filteredCharges.length / itemsPerPage);
    const paginatedCharges = filteredCharges.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDir("asc");
        }
    };

    const handleReset = () => {
        setSearch("");
        setTypeFilter("All");
        setAppliesFilter("All");
        setStatusFilter("All");
        setCurrentPage(1);
    };

    const handleAdd = () => {
        setSelectedCharge(null);
        setIsEditMode(false);
        setShowModal(true);
    };

    const handleEdit = (charge) => {
        setSelectedCharge(charge);
        setIsEditMode(true);
        setShowModal(true);
    };

    const handleSave = async (data) => {
        try {
            if (isEditMode) {
                await chargeService.updateCharge(selectedCharge.id, data);
            } else {
                await chargeService.createCharge(data);
            }
            setShowModal(false);
            setSelectedCharge(null);
            setIsEditMode(false);
            loadCharges();
            loadSummary();
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.message || err.message || "Failed to save charge.";
            alert(msg);
        }
    };

    const handleDuplicate = async (id) => {
        try {
            await chargeService.duplicateCharge(id);
            loadCharges();
            loadSummary();
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.message || err.message || "Failed to duplicate charge.";
            alert(msg);
        }
    };

    const handleToggleStatus = async (charge) => {
        const newStatus = charge.status === "Active" ? "Inactive" : "Active";
        try {
            await chargeService.updateCharge(charge.id, {
                ...charge,
                charge_name: charge.charge_name,
                charge_type: charge.charge_type,
                // Update replaces the whole row: leaving these out would demote
                // a GST row to an ordinary charge just by switching it off and
                // on again, and the bill would silently lose its tax line.
                charge_role: charge.charge_role || "Charge",
                amount: Number(charge.amount),
                auto_apply: Boolean(Number(charge.auto_apply)),
                applies_dinein: Boolean(Number(charge.applies_dinein)),
                applies_takeaway: Boolean(Number(charge.applies_takeaway)),
                applies_delivery: Boolean(Number(charge.applies_delivery)),
                apply_tax: Boolean(Number(charge.apply_tax)),
                status: newStatus
            });
            loadCharges();
            loadSummary();
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.message || err.message || "Failed to update status.";
            alert(msg);
        }
    };

    const handleDeleteClick = (charge) => {
        setDeleteTarget(charge);
        setShowDelete(true);
    };

    const handleConfirmDelete = async () => {
        try {
            await chargeService.deleteCharge(deleteTarget.id);
            setShowDelete(false);
            setDeleteTarget(null);
            loadCharges();
            loadSummary();
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.message || err.message || "Failed to delete charge.";
            alert(msg);
        }
    };

    return (
        <AdminLayout>
            <div className="dashboard-content charges-page">

                <div className="page-header">
                    <div className="page-header-text">
                        <h2>Charges</h2>
                        <p>Configure billing charges, pricing rules and additional restaurant fees.</p>
                    </div>
                    <button className="primary-btn" onClick={handleAdd}>
                        + Add Charge
                    </button>
                </div>

                <ChargeCards summary={summary} />

                <ChargeFilters
                    search={search}
                    onSearch={setSearch}
                    typeFilter={typeFilter}
                    onTypeChange={setTypeFilter}
                    appliesFilter={appliesFilter}
                    onAppliesChange={setAppliesFilter}
                    statusFilter={statusFilter}
                    onStatusChange={setStatusFilter}
                    onReset={handleReset}
                    onAdd={handleAdd}
                />

                <ChargeTable
                    charges={paginatedCharges}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onToggleStatus={handleToggleStatus}
                    onDelete={handleDeleteClick}
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                />

                {totalPages > 1 && (
                    <div className="charges-pagination">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(currentPage - 1)}
                        >
                            Previous
                        </button>
                        {[...Array(totalPages)].map((_, i) => (
                            <button
                                key={i}
                                className={currentPage === i + 1 ? "active-page" : ""}
                                onClick={() => setCurrentPage(i + 1)}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(currentPage + 1)}
                        >
                            Next
                        </button>
                        <span className="page-info">
                            Page {currentPage} of {totalPages}
                        </span>
                    </div>
                )}

                <MenuPricingSection />
            </div>

            <ChargeModal
                show={showModal}
                onClose={() => {
                    setShowModal(false);
                    setSelectedCharge(null);
                    setIsEditMode(false);
                }}
                onSave={handleSave}
                charge={selectedCharge}
                isEditMode={isEditMode}
            />

            <DeleteChargeModal
                show={showDelete}
                charge={deleteTarget}
                onClose={() => {
                    setShowDelete(false);
                    setDeleteTarget(null);
                }}
                onConfirm={handleConfirmDelete}
            />
        </AdminLayout>
    );
}

export default Charges;
