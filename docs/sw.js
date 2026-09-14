// Everything the book needs, kept on the phone: after the first visit it
// opens with no network at all. Bump VERSION when a file changes.
const VERSION = "fob-v1";
const FILES = [
  "./", "index.html", "style.css", "app.js", "manifest.webmanifest",
  "assets/cover.jpg", "assets/page.jpg", "assets/icon-180.png", "assets/icon-512.png",
  "assets/open.mp4", "assets/close.mp4", "assets/turn.mp4", "assets/turn-rev.mp4",
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
// video is served whole from the cache; Safari asks with Range headers, so a
// cached response is sliced by hand when it asks for part of a file
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(request.url, { ignoreSearch: true });
    if (!hit) {
      try { const fresh = await fetch(request); if (fresh.ok && new URL(request.url).origin === location.origin) cache.put(request.url, fresh.clone()); return fresh; }
      catch { return new Response("", { status: 504 }); }
    }
    const range = request.headers.get("range");
    if (!range) return hit;
    const blob = await hit.blob();
    const size = blob.size;
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const start = m ? Number(m[1]) : 0;
    const end = m && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    const part = blob.slice(start, end + 1);
    return new Response(part, { status: 206, headers: { "Content-Type": hit.headers.get("Content-Type") || "video/mp4", "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(part.size), "Accept-Ranges": "bytes" } });
  })());
});
