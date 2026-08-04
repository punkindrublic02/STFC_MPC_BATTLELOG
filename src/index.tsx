import * as React from "react";
import * as ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";

import { App } from "./App";
import { stfcTheme } from "./theme";

const container = document.getElementById("app");
const root = createRoot(container!);
root.render(
  <ThemeProvider theme={stfcTheme}>
    <App />
  </ThemeProvider>,
);
