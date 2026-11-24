import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { requestPersistentStorage } from "./db/db";
import "./styles.css";
import "./lib/install"; // listen for the install prompt before React renders

registerSW({ immediate: true });
requestPersistentStorage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
