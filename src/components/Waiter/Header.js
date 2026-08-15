function Header({
    orderNumber,
    waiterName,
    currentDate,
    currentTime,
    newOrder,
    openRunningOrders,
}) {
    return (
        <div className="dashboard-header">

            {/* Left: Brand + Meta chips */}
            <div className="header-left">
                <div className="header-brand">
                    <svg className="header-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 11l19-9-9 19-2-8-8-2z"/>
                    </svg>
                    <span className="header-brand-name">Waiter Dashboard</span>
                </div>

                <div className="header-chips">
                    <div className="header-chip">
                        <span className="chip-label">Order</span>
                        <span className="chip-value">{orderNumber}</span>
                    </div>
                    <div className="header-chip-divider"/>
                    <div className="header-chip">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                        <span className="chip-value">{waiterName}</span>
                    </div>
                    <div className="header-chip-divider"/>
                    <div className="header-chip">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span className="chip-value">{currentDate}</span>
                    </div>
                    <div className="header-chip-divider"/>
                    <div className="header-chip">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
                        <span className="chip-value">{currentTime}</span>
                    </div>
                </div>
            </div>

            {/* Right: Action buttons */}
            <div className="header-buttons">
                <button className="hdr-btn hdr-btn-primary" onClick={newOrder}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    New Order
                </button>
                <button className="hdr-btn hdr-btn-secondary" onClick={openRunningOrders}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
                    Running Orders
                </button>
                <button className="hdr-btn hdr-btn-secondary">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                    Completed
                </button>
            </div>

        </div>
    );
}

export default Header;