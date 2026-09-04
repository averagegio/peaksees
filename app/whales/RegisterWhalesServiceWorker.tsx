"use client";

import { useEffect } from "react";

export function RegisterWhalesServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/whales/sw.js", { scope: "/whales/" });
  }, []);
  return null;
}
