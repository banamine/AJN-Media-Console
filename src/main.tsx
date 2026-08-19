import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Ensure background services execute asynchronously after mount without blocking
setTimeout(() => {
  try {
    // Initialize non-critical background services here
    import("./services/playbackTelemetry").catch(err => {
      console.debug('[Background Service] Skipped safely:', err);
    });
  } catch (err) {
    console.debug('[Background Service] Skipped safely:', err);
  }
}, 1000);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
