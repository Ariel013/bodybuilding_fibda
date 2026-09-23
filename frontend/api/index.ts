import { handle } from "hono/vercel";
import { createApp } from "../server/app";
import { Store } from "../server/store";

// Entrée Vercel : une seule fonction pour toute l'API. Les secrets viennent des variables d'environnement.
const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("TURSO_DATABASE_URL manquant.");
const store = new Store({ url, authToken: process.env.TURSO_AUTH_TOKEN, demo: process.env.FIBDA_DEMO === "1" });
const app = createApp({ store, setupToken: process.env.FIBDA_SETUP_TOKEN });

export const config = { runtime: "nodejs" };
export default handle(app);
