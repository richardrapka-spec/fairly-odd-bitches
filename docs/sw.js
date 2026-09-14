// Everything the book needs, kept on the phone: after the first visit it
// opens with no network at all. Bump VERSION when a file changes.
const VERSION = "fob-v7";
const FILES = [
  "./", "index.html", "style.css", "app.js", "manifest.webmanifest",
  "assets/cover.jpg", "assets/icon-180.png", "assets/icon-512.png",
  "assets/full.mp4", "assets/full-rev.mp4",
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      // a window still showing the old version reloads itself into this one
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((windows) => Promise.all(windows.map((w) => w.navigate(w.url).catch(() => {}))))
  );
});
// the page fetches each film whole and plays it from a blob, so video is
// served from the cache as a whole file; ranges are sliced only as a courtesy
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(request.url, { ignoreSearch: true });
    const range = request.headers.get("range");
    if (!hit) {
      // a miss goes to the network; only a whole file (200, no Range) is
      // kept, never a partial answer, which would poison every later play
      try {
        const fresh = await fetch(request);
        if (fresh.status === 200 && !range && new URL(request.url).origin === location.origin) cache.put(request.url, fresh.clone());
        return fresh;
      } catch { return new Response("", { status: 504 }); }
    }
    if (!range) return hit;
    const blob = await hit.blob();
    const size = blob.size;
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const start = m ? Number(m[1]) : 0;
    const end = m && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    const part = blob.slice(start, end + 1);
    const headers = new Headers({ "Content-Type": hit.headers.get("Content-Type") || "video/mp4" });
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(part.size));
    headers.set("Accept-Ranges", "bytes");
    return new Response(part, { status: 206, statusText: "Partial Content", headers });
  })());
});
