"use client";

import { Component, type ReactNode } from "react";

/** Import and renderer failures must not leave the office on an endless spinner. */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="alert" className="grid h-full place-content-center gap-4 bg-slate-100 p-6 text-center text-slate-700">
      <p>Não foi possível abrir a cena 3D.</p>
      <button className="rounded-xl bg-slate-900 px-5 py-3 text-white" onClick={() => window.location.reload()}>Recarregar escritório</button>
    </div>;
  }
}
