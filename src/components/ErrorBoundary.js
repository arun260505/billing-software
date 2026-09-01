import React from "react";

/**
 * Catches any render/runtime crash below it and shows the actual error instead
 * of a blank white page. Without this, one thrown error in a page (e.g. the
 * cashier dashboard) unmounts the whole React tree and the user sees nothing —
 * impossible to diagnose. Here the message + stack are on screen to screenshot.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null, info: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        this.setState({ info });
        // Also log to the console so it is captured in DevTools.
        // eslint-disable-next-line no-console
        console.error("App crashed:", error, info);
    }

    render() {
        const { error, info } = this.state;
        if (!error) return this.props.children;

        return (
            <div style={{
                minHeight: "100vh", background: "#0f172a", color: "#e2e8f0",
                fontFamily: "system-ui, sans-serif", padding: "24px",
                boxSizing: "border-box"
            }}>
                <div style={{ maxWidth: 800, margin: "0 auto" }}>
                    <h1 style={{ color: "#f59e0b", marginBottom: 4 }}>Something went wrong</h1>
                    <p style={{ color: "#94a3b8", marginTop: 0 }}>
                        The page hit an error. Send this screen to support.
                    </p>

                    <pre style={{
                        background: "#1e293b", color: "#fecaca", padding: 16,
                        borderRadius: 8, overflow: "auto", whiteSpace: "pre-wrap",
                        fontSize: 13
                    }}>
                        {String(error && (error.stack || error.message || error))}
                    </pre>

                    {info && info.componentStack && (
                        <pre style={{
                            background: "#1e293b", color: "#93c5fd", padding: 16,
                            borderRadius: 8, overflow: "auto", whiteSpace: "pre-wrap",
                            fontSize: 12
                        }}>
                            {info.componentStack}
                        </pre>
                    )}

                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: 12, padding: "10px 18px", border: "none",
                            borderRadius: 8, background: "#f59e0b", color: "#0f172a",
                            fontWeight: 700, cursor: "pointer"
                        }}
                    >
                        Reload
                    </button>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
