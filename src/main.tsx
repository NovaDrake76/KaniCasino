// import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>
);

// the shell booted, so clear the guard in index.html and drop the cache-busting param it
// adds. leaving the flag set would spend the tab's one retry on a failure already survived
try {
  sessionStorage.removeItem("shellRetry");
} catch {
  // storage can be unavailable; the guard is a nicety either way
}
if (new URLSearchParams(window.location.search).has("r")) {
  const url = new URL(window.location.href);
  url.searchParams.delete("r");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}
