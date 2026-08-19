import { safeLocalStorage } from "../utils/safeStorage";
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });
    console.error("[Uncaught Error Boundary Capture]:", error, errorInfo);
  }

  private handleWipeAndReload = () => {
    try {
      try {
        safeLocalStorage.clear();
      } catch (err) {}
      try {
        sessionStorage.clear();
      } catch (err) {}
      // Try to clear IndexedDB if accessible
      let hasIndexedDB = false;
      try {
        hasIndexedDB = typeof window !== "undefined" && !!window.indexedDB;
      } catch (err) {}
      if (hasIndexedDB) {
        window.indexedDB.databases().then((dbs) => {
          dbs.forEach((db) => {
            if (db.name) window.indexedDB.deleteDatabase(db.name);
          });
        }).catch(() => {});
      }
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#030508] text-slate-300 flex items-center justify-center p-6 font-sans antialiased">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-red-950/20 via-[#030508] to-[#010203] pointer-events-none" />
          
          <div className="relative w-full max-w-2xl bg-[#080b11] border border-red-900/30 rounded-2xl p-8 shadow-2xl shadow-red-950/10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 text-2xl font-mono">
                ⚠️
              </div>
              <div>
                <h1 className="text-xl font-bold text-white font-sans tracking-tight">AJN Studio Player crashed</h1>
                <p className="text-xs text-slate-400 mt-1">The rendering engine encountered an unrecoverable exception.</p>
              </div>
            </div>

            <div className="bg-[#030406] border border-slate-800/80 rounded-2xl p-5 font-mono text-[11px] text-red-400 overflow-x-auto select-text max-h-60 space-y-2">
              <div className="font-extrabold text-red-500 uppercase tracking-wider text-[10px] border-b border-red-950/40 pb-2">
                EXCEPTION STACK TRACE
              </div>
              <div className="text-red-300 whitespace-pre-wrap leading-relaxed">
                {this.state.error?.toString()}
              </div>
              {this.state.errorInfo && (
                <div className="text-slate-500 whitespace-pre-wrap leading-relaxed pt-2 border-t border-slate-900/60 mt-2">
                  {this.state.errorInfo.componentStack}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                id="error-boundary-reload-btn"
                onClick={() => window.location.reload()}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium text-xs py-3 px-4 rounded-xl transition-all duration-200 active:scale-95 shadow-lg shadow-red-600/10 focus:outline-none cursor-pointer"
              >
                Reload Player
              </button>
              <button
                id="error-boundary-wipe-btn"
                onClick={this.handleWipeAndReload}
                className="flex-1 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-slate-300 font-medium text-xs py-3 px-4 rounded-xl transition-all duration-200 active:scale-95 focus:outline-none cursor-pointer"
              >
                Clear Sandbox Cache & Reload
              </button>
            </div>

            <div className="text-center">
              <span className="text-[10px] font-mono text-slate-500">
                Studio Player Crash Guard Active • Dev Sandbox v1.4
              </span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
