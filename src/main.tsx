import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootEl = document.getElementById("root")!;
const page =
  (rootEl.getAttribute("data-page") as
    | "home"
    | "calculator"
    | "urlgen"
    | "groups") || "calculator";

createRoot(rootEl).render(<App page={page} />);
