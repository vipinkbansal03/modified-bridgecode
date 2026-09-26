"use client";

import { useEffect } from "react";

const CHUNK_RELOAD_KEY = "chunk_reload_ts";
const RELOAD_COOLDOWN_MS = 10000; // Prevent reload loops within 10s

export function isChunkLoadError(err: any): boolean {
  if (!err) return false;
  const message = typeof err === "string" ? err : err.message || err.name || "";
  return (
    message.includes("ChunkLoadError") ||
    message.includes("Loading chunk") ||
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("MIME type ('text/plain') is not executable") ||
    message.includes("MIME type ('text/html') is not executable") ||
    message.includes("dynamically imported module")
  );
}

export function forceHardReload(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    const url = new URL(window.location.href);
    url.searchParams.set("_r", Date.now().toString());
    window.location.href = url.toString();
  } catch {
    window.location.reload();
  }
}

export function attemptHardReload(): void {
  try {
    const lastReload = sessionStorage.getItem(CHUNK_RELOAD_KEY);
    const now = Date.now();
    if (!lastReload || now - parseInt(lastReload, 10) > RELOAD_COOLDOWN_MS) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, now.toString());
      const url = new URL(window.location.href);
      url.searchParams.set("_r", Date.now().toString());
      window.location.href = url.toString();
    }
  } catch {
    window.location.reload();
  }
}

export function ChunkErrorRecovery() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        console.warn("[ChunkErrorRecovery] Stale chunk detected on error event, refreshing page to load updated build...");
        event.preventDefault();
        attemptHardReload();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        console.warn("[ChunkErrorRecovery] Stale chunk detected on unhandled rejection, refreshing page to load updated build...");
        event.preventDefault();
        attemptHardReload();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
