import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";
import "./styles/app-shell.css";
import "./styles/overlays.css";
import "katex/dist/katex.min.css";

const el = document.getElementById("root");
if (!el) throw new Error("missing #root");

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
