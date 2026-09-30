const SHELL = "shell-v9"; // bump this when you change app files
const LIB = "lib-v1";     // caches the transformers.js + onnxruntime files
const FILES = ["./", "index.html", "app.js", "worker.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) =>
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));

self.addEventListener("activate", (e) =>
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith("shell-") && k !== SHELL).map((k) => caches.delete(k))))
    .then(() => clients.claim())));

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  const lib = u.hostname === "cdn.jsdelivr.net";
  if (e.request.method !== "GET" || !(lib || u.origin === location.origin)) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(lib ? LIB : SHELL).then((x) => x.put(e.request, c)); }
    return r;
  })));
});
