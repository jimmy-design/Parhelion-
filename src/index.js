
import React from "react";
import ReactDOM from "react-dom/client";
import "./App.css";
import AuthShell from "./AuthShell";
import { getAppMode } from "./appConfig";

const root = ReactDOM.createRoot(document.getElementById("root"));
const appMode = getAppMode();

document.title = appMode === "erp" ? "ParhelionERP" : "ParhelionPOS";

root.render(<AuthShell appMode={appMode} />);
