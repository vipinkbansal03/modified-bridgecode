// Placeholder service worker.
// This app does not currently initialize Firebase Messaging, but some browsers
// may still request this path from an old registration or extension probe.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
