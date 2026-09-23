// Serveur de développement local : API TypeScript + fichiers de dist, sur une base libSQL fichier.
// Usage : npm run build && npm run dev:server  (puis http://127.0.0.1:8877). Jamais utilisé en production.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createApp } from "./app";
import { Store } from "./store";

const url = process.env.TURSO_DATABASE_URL ?? "file:./fibda-dev.sqlite";
// Le jeton de repli « dev » n'est admis que sur une base fichier locale, jamais vers une base distante.
if (!url.startsWith("file:") && !process.env.FIBDA_SETUP_TOKEN) throw new Error("FIBDA_SETUP_TOKEN obligatoire avec une base distante.");
const store = new Store({ url, authToken: process.env.TURSO_AUTH_TOKEN, demo: process.env.FIBDA_DEMO === "1" });
const api = createApp({ store, setupToken: process.env.FIBDA_SETUP_TOKEN ?? "dev" });
const app = new Hono();
app.route("/", api);
app.use("/*", serveStatic({ root: "./dist" }));
app.get("*", serveStatic({ root: "./dist", path: "index.html" }));
const port = Number(process.env.PORT ?? 8877);
serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, () => console.log(`FIBDA (TypeScript) sur http://127.0.0.1:${port} — base ${url}`));
