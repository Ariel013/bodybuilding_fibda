// Service worker FIBDA — cache limité aux fichiers statiques de l'app shell.
// Règle (RULES.md §Sécurité) : jamais de cache d'une réponse d'API. Toute requête
// dont le chemin commence par /api/ est ignorée ici : le navigateur la traite seul.
// Incrémenter CACHE_VERSION à chaque changement de stratégie ; les fichiers Vite
// étant hachés, une nouvelle build est de toute façon recachée à la demande.
const CACHE_VERSION = "fibda-shell-v1";

// Chemins statiques précachés à l'installation (le JS/CSS hachés le sont au premier chargement).
const PRECACHE = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

// Un chemin est « statique » s'il vient de /assets (build Vite, police, logos), de /icons, ou est le manifest.
function isStatic(pathname) {
  return (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/apple-touch-icon.png"
  );
}

// L'app shell (point d'entrée HTML) : réseau d'abord, cache en secours hors ligne.
function isShell(pathname) {
  return pathname === "/" || pathname === "/index.html";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined) // Un échec de précache ne doit pas empêcher l'installation.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Uniquement les GET de même origine : tout le reste (POST, WebSocket, autre origine) passe tel quel.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Jamais d'interception de l'API (bulletins, photos, WebSocket) : pas de respondWith.
  if (url.pathname.startsWith("/api/")) return;

  if (isStatic(url.pathname)) {
    // Cache d'abord : les fichiers Vite sont hachés, une réponse en cache est toujours valide.
    // Seul un 200 complet est stocké : un 206 (réponse partielle à un en-tête Range) casserait l'app.
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((response) => {
              if (response.status === 200) cache.put(request, response.clone());
              return response;
            }),
        ),
      ),
    );
    return;
  }

  if (isShell(url.pathname)) {
    // Réseau d'abord pour toujours servir la dernière build ; repli sur le cache hors ligne.
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) =>
        fetch(request)
          .then((response) => {
            if (response.status === 200) cache.put("/", response.clone());
            return response;
          })
          .catch(() => cache.match("/")),
      ),
    );
  }
  // Tout autre chemin : non intercepté.
});
