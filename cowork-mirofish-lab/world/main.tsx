import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import WorldPage from "../../app/world/page";
import "../../app/globals.css";
import "../../app/world/world.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WorldPage />
  </StrictMode>,
);
