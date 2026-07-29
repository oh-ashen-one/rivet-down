import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import RivetDown from "../../app/components/RivetDown";
import "../../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RivetDown />
  </StrictMode>,
);
