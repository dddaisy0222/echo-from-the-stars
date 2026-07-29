import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import MiroFishLab from "../app/mirofish/page";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MiroFishLab />
  </StrictMode>,
);
