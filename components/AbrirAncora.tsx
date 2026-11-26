"use client";
import { useEffect } from "react";

/** Depois de salvar, abre de novo o serviço que estava sendo editado. */
export default function AbrirAncora() {
  useEffect(() => {
    const el = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (el instanceof HTMLDetailsElement) { el.open = true; el.scrollIntoView({ block: "start" }); }
  }, []);
  return null;
}
