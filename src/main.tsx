import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router";
import { AppRoutes } from "./app/AppRoutes";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  </StrictMode>,
);
