import { landingTab } from "./judgeSelection";
import { ConnectionHelp } from "./ConnectionHelp";
import { canCommand } from "./permissions";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, post, APIError } from "./api";
import { type State, type Entity, uid, labels } from "./types";
import { Preparation, Documents } from "./Preparation";
import { Judge } from "./Judge";
import { Competition, Exams, Collective } from "./Competition";
import { Regie, PublicScreen, Rewards } from "./Regie";
import { Aide } from "./Aide";
import { Parcours } from "./Parcours";
import { Panel, Notice, Field, Status, DataTable, JsonDetails } from "./ui";
const navigation = [
  {
    id: "parcours",
    label: "Parcours",
    icon: "➔",
    roles: ["chief", "responsable", "director", "secretariat"],
  },
  { id: "home", label: "Vue d’ensemble", icon: "◈", roles: [] },
  {
    id: "preparation",
    label: "Préparation",
    icon: "▤",
    roles: ["chief", "responsable", "director", "secretariat"],
  },
  {
    id: "judge",
    label: "Mon jugement",
    icon: "▦",
    roles: ["chief", "responsable", "judge", "trainee"],
  },
  {
    id: "competition",
    label: "Compétition",
    icon: "◷",
    roles: ["chief", "responsable", "director"],
  },
  {
    id: "regie",
    label: "Régie & écrans",
    icon: "▣",
    roles: ["chief", "responsable", "director", "regie", "speaker"],
  },
  {
    id: "rewards",
    label: "Récompenses",
    icon: "◇",
    roles: ["chief", "responsable", "director", "regie", "secretariat"],
  },
  {
    id: "collective",
    label: "Collectifs",
    icon: "◎",
    roles: ["chief", "responsable", "director", "commission"],
  },
  {
    id: "exams",
    label: "Examens",
    icon: "✓",
    roles: [
      "chief",
      "responsable",
      "commission",
      "director",
      "judge",
      "trainee",
    ],
  },
  {
    id: "documents",
    label: "Documents",
    icon: "▱",
    roles: [
      "chief",
      "responsable",
      "director",
      "secretariat",
      "commission",
      "judge",
      "trainee",
    ],
  },
  {
    id: "audit",
    label: "Traçabilité",
    icon: "≡",
    roles: ["chief", "director"],
  },
  { id: "aide", label: "Aide", icon: "?", roles: [] },
];
/** Vrai si la personne n'a que des rôles juge et/ou stagiaire (même critère que l'onglet d'arrivée, testé dans ranking.test.ts). */
function judgeOnlyProfile(roles: string[]): boolean {
  return landingTab(roles) === "judge";
}
/**
 * Onglet d'arrivée après connexion : bulletin pour un juge ou stagiaire seul, Parcours pour
 * la direction et le secrétariat (demande du PO, 24/09/2026), Vue d'ensemble sinon.
 */
function arrivalTab(roles: string[]): string {
  const base = landingTab(roles);
  if (base === "judge") return base;
  return navigation[0].roles.some((r) => roles.includes(r)) ? "parcours" : base;
}
export default function App() {
  const screen = location.pathname.match(
    /^\/screen\/(main|secondary|backstage|speaker)\/?$/,
  )?.[1];
  return screen ? <PublicScreen name={screen} /> : <Workspace />;
}
function Workspace() {
  const [s, setState] = useState<State>(),
    [health, setHealth] = useState<any>(),
    [user, setUser] = useState<Entity>(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [connection, setConnection] = useState("Connexion…"),
    [tab, setTab] = useState(location.hash.slice(1).split("/")[0]),
    [pending, setPending] = useState(false);
  const current = useRef<State | undefined>(undefined);
  const commandQueue = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const state = await api("/state");
      current.current = state;
      setState(state);
      setUser(state.me);
      setConnection("Connecté au serveur");
    } catch (e) {
      if (e instanceof APIError && e.status === 401) {
        setUser(undefined);
        setState(undefined);
        current.current = undefined;
      } else setConnection("Connexion interrompue");
      throw e;
    }
  }, []);
  useEffect(() => {
    async function boot() {
      try {
        const h = await api("/health");
        setHealth(h);
        if (!h.setup_required) {
          try {
            const me = await api("/auth/me");
            setUser(me.user);
            await refresh();
          } catch (e) {
            if (!(e instanceof APIError && e.status === 401))
              setError((e as Error).message);
          }
        }
      } catch (e) {
        setError("Serveur inaccessible : " + (e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, [refresh]);
  useEffect(() => {
    const change = () => setTab(location.hash.slice(1).split("/")[0]);
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (!user) return;
    let disposed = false;
    let socket: WebSocket;
    let reconnect: ReturnType<typeof setTimeout>;
    // Le serveur serverless (Vercel) n'a pas de WebSocket : si la première connexion n'aboutit
    // jamais, on n'insiste pas et l'état « Connecté » suit l'interrogation périodique.
    let everOpened = false;
    let pollEvery = 10000;
    const connect = () => {
      socket = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/v1/ws`,
      );
      socket.onopen = () => {
        everOpened = true;
        setConnection("Connecté au serveur");
        refresh().catch(() => {});
      };
      socket.onmessage = () => refresh().catch(() => {});
      socket.onclose = () => {
        if (disposed) return;
        if (!everOpened) {
          pollEvery = 6000;
          restartPoll();
          return;
        }
        setConnection("Reconnexion…");
        reconnect = setTimeout(connect, 2500);
      };
      socket.onerror = () => socket.close();
    };
    connect();
    let poll = setInterval(() => refresh().catch(() => {}), pollEvery);
    const restartPoll = () => {
      clearInterval(poll);
      poll = setInterval(() => refresh().catch(() => {}), pollEvery);
    };
    const online = () => refresh().catch(() => {});
    window.addEventListener("online", online);
    return () => {
      disposed = true;
      clearTimeout(reconnect);
      clearInterval(poll);
      socket?.close();
      window.removeEventListener("online", online);
    };
  }, [user?.id, refresh]);
  async function command(type: string, payload: Record<string, any> = {}) {
    if (commandQueue.current) throw new Error("Une action est déjà en cours.");
    if (!current.current) throw new Error("Session expirée. Reconnectez-vous.");
    commandQueue.current = true;
    setPending(true);
    setError("");
    try {
      const result = await post("/command", {
        id: uid(),
        version: current.current.version,
        type,
        payload,
      });
      if (result.state) {
        current.current = result.state;
        setState(result.state);
      } else await refresh();
      setNotice(
        type === "ballot.submit"
          ? "Accusé de réception serveur reçu."
          : "Modification enregistrée sur le serveur.",
      );
      return result;
    } catch (e) {
      let message = (e as Error).message;
      if (e instanceof APIError && e.status === 409) {
        await refresh().catch(() => {});
        message =
          "L’état a changé sur un autre appareil. Les données ont été actualisées ; vérifiez votre saisie puis relancez explicitement l’action. " +
          message;
      } else if (e instanceof APIError && e.status === 401) {
        setUser(undefined);
        setState(undefined);
      }
      setError(message);
      throw new Error(message);
    } finally {
      commandQueue.current = false;
      setPending(false);
    }
  }
  // Demande du PO (24/09/2026) : un compte qui n'a que des rôles juge et/ou stagiaire ne voit que
  // « Mon jugement » et « Aide », en pleine largeur, pour se concentrer sur son bulletin.
  const judgeOnly = judgeOnlyProfile(user?.roles || []);
  const available = navigation.filter(
    (n) =>
      (!n.roles.length || n.roles.some((r) => user?.roles?.includes(r))) &&
      !(n.id === "judge" && user?.roles?.includes("director")) &&
      // Profil juge ou stagiaire seul : Mon jugement, Aide, et ses propres documents
      // (bulletin imprimable ; rapport d'examen pour un stagiaire).
      (!judgeOnly || ["judge", "aide", "documents", "exams"].includes(n.id)),
  );
  const active = available.some((n) => n.id === tab)
    ? tab
    : arrivalTab(user?.roles || []);
  if (loading)
    return (
      <div className="loading">
        <img src="/assets/fibda-logo.jpg" alt="FIBDA" />
        <p>Connexion à votre compétition…</p>
      </div>
    );
  if (!user || !s)
    return (
      <Login
        setup={health?.setup_required}
        demo={health?.demo}
        error={error}
        onSuccess={async () => {
          setError("");
          setHealth(await api("/health"));
          await refresh();
          const destination = arrivalTab(current.current?.me.roles || []);
          setTab(destination);
          location.hash = destination;
        }}
      />
    );
  return (
    <div
      className={
        "app-shell" +
        (active === "judge" ? " judge-mode" : "") +
        (judgeOnly ? " judge-only" : "")
      }
    >
      <aside className="sidebar">
        <a className="brand" href="#home">
          <span className="brand-plate">
            <img src="/assets/fibda-logo.jpg" alt="FIBDA" />
          </span>
          <span>
            <strong>COMPÉTITION</strong>
            <small>Le sport, au premier plan.</small>
          </span>
        </a>
        <div className="event-mini">
          <span className="eyebrow">
            ESPACE {s.demo ? "DÉMONSTRATION" : "OFFICIEL"}
          </span>
          <strong>{s.name}</strong>
          <small>
            {s.date} · {s.location}
          </small>
        </div>
        <nav aria-label="Navigation principale">
          {available.map((n) => (
            <a
              key={n.id}
              href={"#" + n.id}
              className={active === n.id ? "active" : ""}
            >
              <span>{n.icon}</span>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="live-dot" /> {connection}
          <small>État serveur v{s.version}</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <strong>{user.name}</strong>
            <small>
              {user.roles?.map((r: string) => labels[r]).join(" · ")}
            </small>
          </div>
          {!judgeOnly && (
            <label className="global-mode">
              <span>
                Mode{" "}
                {s.status !== "preparation" ? "· verrouillé" : "de compétition"}
              </span>
              <select
                aria-label="Mode de compétition"
                value={s.mode}
                disabled={
                  s.status !== "preparation" ||
                  pending ||
                  !canCommand(user.roles, "event.update")
                }
                onChange={(e) => {
                  command("event.update", { mode: e.target.value }).catch(
                    () => {},
                  );
                }}
              >
                <option value="national">National</option>
                <option value="international">International</option>
              </select>
            </label>
          )}
          <div className="actions">
            {s.demo && <span className="badge demo">DÉMONSTRATION</span>}
            <span className="connection">
              <i
                className={connection.startsWith("Connecté") ? "online" : ""}
              />
              {connection}
            </span>
            <button
              className="ghost"
              onClick={async () => {
                await post("/auth/logout", {}).catch(() => {});
                setState(undefined);
                setUser(undefined);
                current.current = undefined;
              }}
            >
              Déconnexion
            </button>
          </div>
        </header>
        <main>
          {!connection.startsWith("Connecté") && (
            <Notice kind="warning">
              {connection} Les brouillons restent locaux. Attendez un accusé
              serveur avant de considérer une action comme enregistrée.
            </Notice>
          )}
          {error && (
            <Notice kind="error" className="toast-error">
              <div className="panel-head">
                <span>{error}</span>
                <button
                  className="ghost icon"
                  aria-label="Fermer le message"
                  onClick={() => setError("")}
                >
                  ×
                </button>
              </div>
            </Notice>
          )}
          {notice && (
            <Notice kind="success">
              <div className="panel-head">
                <span>{notice}</span>
                <button
                  className="ghost icon"
                  aria-label="Fermer la confirmation"
                  onClick={() => setNotice("")}
                >
                  ×
                </button>
              </div>
            </Notice>
          )}
          {pending && (
            <div className="saving-bar">Enregistrement sur le serveur…</div>
          )}
          {active === "home" ? (
            <Home s={s} />
          ) : active === "parcours" ? (
            <Parcours s={s} command={command} />
          ) : active === "preparation" ? (
            <Preparation s={s} command={command} refresh={refresh} />
          ) : active === "judge" ? (
            <Judge s={s} command={command} />
          ) : active === "competition" ? (
            <Competition s={s} command={command} />
          ) : active === "regie" ? (
            <Regie s={s} command={command} />
          ) : active === "rewards" ? (
            <Rewards s={s} command={command} />
          ) : active === "exams" ? (
            <Exams s={s} command={command} />
          ) : active === "collective" ? (
            <Collective s={s} command={command} />
          ) : active === "documents" ? (
            <Documents s={s} command={command} refresh={refresh} />
          ) : active === "aide" ? (
            <Aide roles={user.roles || []} />
          ) : (
            <Audit s={s} />
          )}
        </main>
        <footer>
          FIBDA · {s.name} ·{" "}
          {s.demo ? "Données de démonstration" : "Événement en exploitation"}
          <span>Manrope · Interface locale</span>
        </footer>
      </div>
    </div>
  );
}
function Login({
  setup,
  demo,
  error: external,
  onSuccess,
}: {
  setup: boolean;
  demo: boolean;
  error: string;
  onSuccess: () => Promise<void>;
}) {
  const [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [codes, setCodes] = useState<Record<string, any>>();
  return (
    <div className="login-page">
      <div className="login-story">
        <img src="/assets/fibda-logo.jpg" alt="FIBDA" />
        <p className="eyebrow">BODYBUILDING · FIBDA</p>
        <h1>
          Chaque athlète.
          <br />
          Chaque décision.
          <br />
          <em>Une compétition.</em>
        </h1>
        <p>
          Préparer, juger, révéler.
          <br />
          L’espace de travail de votre équipe.
        </p>
      </div>
      <section className="login-card">
        <p className="eyebrow">
          {setup ? "PREMIÈRE OUVERTURE" : "ACCÈS PERSONNEL"}
        </p>
        <h2>
          {setup ? "Installer le chef de jury" : "Bienvenue dans votre espace"}
        </h2>
        <p>
          {setup
            ? "Créez le premier accès sur l’ordinateur serveur."
            : "Saisissez le code personnel remis par l’organisation."}
        </p>
        {(error || external) && (
          <Notice kind="error">{error || external}</Notice>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await post(
                setup ? "/auth/setup" : "/auth/login",
                setup ? { name, code } : { code },
              );
              await onSuccess();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {setup && (
            <Field label="Nom du chef de jury">
              <input
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          )}
          <Field label="Code personnel">
            <input
              required
              minLength={4}
              type="password"
              autoComplete={setup ? "new-password" : "current-password"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
          </Field>
          <button className="wide" disabled={busy}>
            {busy
              ? "Connexion…"
              : setup
                ? "Créer mon accès"
                : "Accéder à la compétition"}
          </button>
        </form>
        <small className="privacy-note">
          Le code reste personnel. Les droits de chaque rôle sont contrôlés par
          le serveur.
        </small>
        {!setup && <ConnectionHelp />}
        {!setup && (
          <details className="aide-connexion">
            <summary>Mode d’emploi</summary>
            <Aide />
          </details>
        )}
        {demo && (
          <details>
            <summary>Initialiser la démonstration isolée</summary>
            <p>
              Cette action est disponible uniquement sur le serveur de
              démonstration lancé avec l’option dédiée.
            </p>
            <button
              disabled={busy}
              className="ghost"
              onClick={async () => {
                // Version en ligne : le peuplement exige le jeton de configuration du serveur
                // (variable FIBDA_SETUP_TOKEN), remis à l'organisateur avec les codes.
                const jeton = window.prompt("Jeton de configuration du serveur de démonstration :");
                if (jeton === null) return;
                setBusy(true);
                try {
                  const r = await api("/demo", { method: "POST", body: "{}", headers: { "x-setup-token": jeton.trim() } });
                  if (r.codes && Object.keys(r.codes).length === 0) {
                    setError("La démonstration est déjà peuplée : connectez-vous avec les codes remis lors du premier peuplement (ou, pour repartir de zéro, utilisez « Revenir en préparation » depuis le compte chef).");
                  } else {
                    setCodes(r.codes);
                    setError("");
                  }
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Créer les données de démonstration
            </button>
            {codes && (
              <>
                <p>Codes de démonstration à utiliser pour se connecter :</p>
                <dl>
                  {Object.entries(codes).map(([k, v]) => (
                    <div key={k}>
                      <dt>{v.name || labels[k] || k}</dt>
                      <dd>
                        <code>{v.code || v}</code>
                      </dd>
                    </div>
                  ))}
                </dl>
                <button onClick={() => onSuccess()}>
                  Entrer dans la démonstration
                </button>
              </>
            )}
          </details>
        )}
      </section>
    </div>
  );
}
function Home({ s }: { s: State }) {
  const active = s.rounds.find((r) => r.id === s.active_round_id);
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">LE FIL DE VOTRE COMPÉTITION</p>
          <h1>{s.name}</h1>
          <p>
            {s.location} · {s.date} ·{" "}
            {s.mode === "national"
              ? "Championnat national"
              : "Compétition internationale"}
          </p>
        </div>
        <Status value={s.status} />
      </div>
      <div className="hero">
        <div>
          <p className="eyebrow">
            {active ? "SUR LE PLATEAU" : "TOUT COMMENCE ICI"}
          </p>
          <h2>
            {active
              ? s.categories.find((c) => c.id === active.category_id)?.name
              : "Une organisation claire. Un jugement serein."}
          </h2>
          <p>
            {active
              ? `${labels[active.phase]} · ${labels[active.status]}`
              : "Préparez les inscriptions et le jury, puis ouvrez la première manche."}
          </p>
          <a
            className="button"
            href={
              s.me.roles.includes("judge") || s.me.roles.includes("trainee")
                ? "#judge"
                : "#preparation"
            }
          >
            {s.me.roles.includes("judge") || s.me.roles.includes("trainee")
              ? "Ouvrir mon bulletin"
              : "Préparer la compétition"}{" "}
            →
          </a>
        </div>
        <img src="/assets/fibda-logo.jpg" alt="FIBDA" />
      </div>
      <div className="metrics">
        <div>
          <strong>{s.people.length}</strong>
          <span>Athlètes</span>
        </div>
        <div>
          <strong>{s.categories.filter((c) => !c.archived).length}</strong>
          <span>Catégories</span>
        </div>
        <div>
          <strong>
            {
              s.rounds.filter((r) =>
                ["validated", "published"].includes(r.status),
              ).length
            }{" "}
            / {s.rounds.length}
          </strong>
          <span>Manches validées</span>
        </div>
        <div>
          <strong>
            {s.people.filter((p) => p.measurements_confirmed).length}
          </strong>
          <span>Mesures confirmées</span>
        </div>
      </div>
      <div className="split">
        <Panel title="À suivre">
          <DataTable
            columns={["Catégorie", "Phase", "État"]}
            rows={s.rounds
              .filter((r) => !["validated", "published"].includes(r.status))
              .slice(0, 6)
              .map((r) => [
                s.categories.find((c) => c.id === r.category_id)?.name,
                labels[r.phase],
                <Status value={r.status} />,
              ])}
          />
        </Panel>
        <Panel title="Informations de l’organisation">
          {s.alerts?.length ? (
            s.alerts
              .slice(-8)
              .reverse()
              .map((a: any, i: number) => (
                <Notice key={i} kind="warning">
                  {typeof a === "string"
                    ? a
                    : a.message || a.reason || JSON.stringify(a)}
                </Notice>
              ))
          ) : (
            <p className="empty">Aucune alerte en cours.</p>
          )}
          <p className="muted">
            Les écrans publics restent sous le contrôle de la régie. La
            réception d’un bulletin et la validation des résultats sont deux
            étapes distinctes.
          </p>
        </Panel>
      </div>
    </>
  );
}
function Audit({ s }: { s: State }) {
  const [data, setData] = useState<any>(s.audit || []),
    [error, setError] = useState("");
  useEffect(() => {
    api("/audit")
      .then(setData)
      .catch((e) => setError(e.message));
  }, [s.version]);
  return (
    <>
      <h1>Traçabilité</h1>
      {error && <Notice kind="error">{error}</Notice>}
      <Panel title="Journal du serveur">
        <p>
          Actions, auteurs et versions conservés pour permettre le contrôle de
          la compétition.
        </p>
        <JsonDetails label="Afficher le journal complet" data={data} />
      </Panel>
    </>
  );
}
