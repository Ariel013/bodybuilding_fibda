// Entrée Vercel : une seule fonction pour toute l'API (regroupée par esbuild dans api/index.js).
// Les secrets viennent des variables d'environnement. Le démarrage est différé dans le
// gestionnaire pour qu'une erreur de configuration produise une réponse lisible.
// Le gestionnaire accepte la signature Node (req, res) et la signature web (Request → Response).
import { getRequestListener } from "@hono/node-server";
import type { IncomingMessage, ServerResponse } from "node:http";

type Fetcher = (req: Request) => Response | Promise<Response>;
let appPromise: Promise<{ fetch: Fetcher }> | null = null;

async function boot() {
  const [{ createApp }, { Store }] = await Promise.all([import("./app"), import("./store")]);
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL manquant.");
  const store = new Store({ url, authToken: process.env.TURSO_AUTH_TOKEN, demo: process.env.FIBDA_DEMO === "1" });
  return createApp({ store, setupToken: process.env.FIBDA_SETUP_TOKEN });
}

const fetchApp: Fetcher = async (req) => {
  try {
    appPromise ??= boot();
    return await (await appPromise).fetch(req);
  } catch (e) {
    appPromise = null;
    console.error("Démarrage impossible :", e);
    return new Response(JSON.stringify({ detail: "Serveur indisponible : configuration à vérifier." }), { status: 500, headers: { "content-type": "application/json" } });
  }
};

const nodeListener = getRequestListener(fetchApp);

export default function handler(req: IncomingMessage | Request, res?: ServerResponse): Response | Promise<Response> | void {
  if (res && typeof (req as IncomingMessage).on === "function") return void nodeListener(req as IncomingMessage, res);
  return fetchApp(req as Request);
}
