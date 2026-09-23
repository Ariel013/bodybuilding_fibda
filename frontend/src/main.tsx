import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>L’interface doit être rechargée</h1>
        <p>Les bulletins déjà reçus restent conservés sur le serveur.</p>
        <pre>{this.state.error}</pre>
        <button onClick={() => location.reload()}>Recharger</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
// Service worker PWA (fichiers statiques seulement, voir public/sw.js). Enregistré après le
// chargement, uniquement sur HTTPS ou en boucle locale, et sans jamais bloquer l'interface.
if ("serviceWorker" in navigator) {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  if (location.protocol === "https:" || local) {
    window.addEventListener("load", () => {
      try {
        navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      } catch {
        // Enregistrement impossible : l'app fonctionne sans PWA.
      }
    });
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
