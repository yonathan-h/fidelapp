import { Component } from "react";

// catches render-time errors anywhere below it in the tree -- without this, an
// uncaught error in a component (not an API call, those already have their own
// try/catch) blanks the whole page to white with nothing but a console error
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("unhandled error in app tree:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ maxWidth: "420px", textAlign: "center" }}>
            <p className="font-display" style={{ fontSize: "22px", fontWeight: 500, margin: "0 0 10px" }}>
              Something went wrong.
            </p>
            <p style={{ color: "var(--ink-soft)", fontSize: "14px", margin: "0 0 20px" }}>
              Try reloading the page. If it keeps happening, your progress is saved server-side, so nothing's lost.
            </p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
