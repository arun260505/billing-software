import React from "react";
import ReactDOM from "react-dom/client";

import "bootstrap/dist/css/bootstrap.min.css";

import "./index.css";

import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

// Safari (and mobile Safari especially) restores a whole page from its
// back/forward cache on a Back gesture: the DOM comes back exactly as it was,
// with no React re-render and no re-read of localStorage. So after logging out,
// pressing Back brought the previous screen back on-screen — staff data and all
// — even though the token was already gone. `event.persisted` marks a restore
// from that cache; reloading forces the auth check to run again, which lands on
// the login page. It costs nothing on a normal back navigation, which does not
// set the flag.
window.addEventListener("pageshow", (event) => {
    if (event.persisted && !localStorage.getItem("token")) {
        window.location.reload();
    }
});

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>
);