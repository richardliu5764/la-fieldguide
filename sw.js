/* Excurse root service worker — offline-first shell.
   Hashed assets + fonts: cache-first (immutable). index.html, manifest, trip-data.enc:
   network-first with a short timeout, falling back to cache, so a weak signal never
   blocks boot. Cache name is stamped per deploy; old caches die on activate.
   20260612052758 is substituted by scripts/deploy.sh. */
const CACHE = "excurse-20260612052758";
const NET_TIMEOUT = 3500;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

/* Timeout via race, not AbortController: navigation Requests cannot be re-constructed
   with an init object (mode "navigate" throws), but racing the original is fine. */
function raceNet(req) {
  return Promise.race([
    fetch(req),
    new Promise((_, rej) => setTimeout(() => rej(new Error("net-timeout")), NET_TIMEOUT)),
  ]);
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.includes("/classic/")) return; // the classic edition runs its own worker
  const navigate = e.request.mode === "navigate";
  const wantsFresh = navigate
    || url.pathname.endsWith("trip-data.enc")
    || url.pathname.endsWith("manifest.webmanifest")
    || url.pathname.endsWith("sw.js");
  e.respondWith(wantsFresh ? networkFirst(e.request, navigate) : cacheFirst(e.request));
});

async function networkFirst(req, navigate) {
  const cache = await caches.open(CACHE);
  try {
    const r = await raceNet(req);
    if (r && r.ok) cache.put(req, r.clone());
    return r;
  } catch (err) {
    const hit = await cache.match(req, navigate ? { ignoreSearch: true } : undefined);
    if (hit) return hit;
    if (navigate) {
      const shell = (await cache.match("index.html")) || (await cache.match("./"));
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r && r.ok) cache.put(req, r.clone());
  return r;
}
