import { paysAvecDrapeau } from "./pays";
import { canCommand } from "./permissions";
import { useEffect, useState, useRef } from "react";
import {
  projectionGroup,
  photoMode,
  photoFor,
  shouldAnimateScene,
} from "./projection";
import { api } from "./api";
import {
  type State,
  type Entity,
  type Command,
  personName,
  labels,
} from "./types";
import {
  Panel,
  Field,
  AsyncButton,
  Multi,
  Notice,
  Check,
  entryLabel,
  DataTable,
  Empty,
} from "./ui";
const screens: Record<string, string> = {
  main: "Écran principal",
  secondary: "Écran secondaire",
  backstage: "Coulisses",
  speaker: "Speaker",
};
const scenes: Record<string, string> = {
  idle: "Accueil",
  category: "Catégorie / mosaïque",
  qualifiers: "Qualifiés",
  reveal: "Révélation progressive",
  podium: "Podium",
  ranking: "Classement",
  official: "Un officiel",
  officials: "Mosaïque des officiels",
};
/** Scènes qui exigent une manche au résultat validé ou publié (le serveur le vérifie aussi). */
const VALIDATED_SCENES = ["qualifiers", "reveal", "podium", "ranking"];
const CLOSED = ["validated", "published"];
/**
 * Catégories proposées à la régie : celles de l'état, plus les catégories virtuelles des overalls
 * (toutes catégories, overall final) qui n'y figurent pas mais portent bien des manches.
 */
export function regieCategories(s: State): { id: string; name: string }[] {
  const known = new Set(s.categories.map((c) => c.id));
  const virtual = new Map<string, string>();
  for (const r of s.rounds) {
    if (known.has(r.category_id) || virtual.has(r.category_id)) continue;
    virtual.set(
      r.category_id,
      r.grand_final
        ? "Overall final · " + (labels[r.section ?? ""] || r.section || "")
        : `Toutes catégories · ${r.discipline || ""} ${labels[r.section ?? ""] || r.section || ""}`.trim(),
    );
  }
  return [
    ...s.categories.map((c) => ({ id: c.id, name: c.name })),
    ...Array.from(virtual, ([id, name]) => ({ id, name })),
  ];
}
/**
 * Manches proposées pour une catégorie et un contenu (PO 24/09/2026) : uniquement celles de la
 * catégorie choisie ; pour un contenu de résultat, uniquement celles au résultat validé ou publié.
 * Sans catégorie, aucune manche.
 */
export function roundsFor(s: State, category: string, kind: string) {
  if (!category) return [];
  return s.rounds.filter(
    (r) =>
      r.category_id === category &&
      (!VALIDATED_SCENES.includes(kind) || CLOSED.includes(r.status)),
  );
}
/**
 * Manche présélectionnée parmi les manches proposées : la manche courante si elle en fait
 * partie, sinon la dernière validée, sinon l'unique manche proposée, sinon aucune.
 */
export function defaultRound(
  s: State,
  proposed: { id: string; status: string }[],
): string {
  const active = proposed.find((r) => r.id === s.active_round_id);
  if (active) return active.id;
  const closed = proposed.filter((r) => CLOSED.includes(r.status));
  if (closed.length) return closed[closed.length - 1].id;
  return proposed.length === 1 ? proposed[0].id : "";
}
export function Regie({ s, command }: { s: State; command: Command }) {
  const activeRound = s.rounds.find((r) => r.id === s.active_round_id);
  const [screen, setScreen] = useState("main"),
    [kind, setKind] = useState("idle"),
    [category, setCategory] = useState(
      activeRound?.category_id || s.categories[0]?.id || "",
    ),
    [round, setRound] = useState(s.active_round_id || ""),
    [official, setOfficial] = useState(""),
    [officials, setOfficials] = useState<string[]>([]),
    [revealed, setRevealed] = useState(0),
    [called, setCalled] = useState(""),
    [positions, setPositions] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  const scene = {
    kind,
    category_id: category,
    round_id: round,
    official_id: official,
    official_ids: officials,
    revealed_count: revealed,
    called_entry_id: called,
    positions,
  };
  const categoryOptions = regieCategories(s);
  const proposedRounds = roundsFor(s, category, kind);
  // La manche suit toujours la catégorie et le contenu choisis : jamais une manche d'une autre
  // catégorie, jamais une manche non validée pour un contenu de résultat.
  useEffect(() => {
    if (!proposedRounds.some((r) => r.id === round))
      setRound(defaultRound(s, proposedRounds));
  }, [category, kind, s.version]);
  const selected = s.rounds.find((r) => r.id === round);
  const canDirect = s.me.roles.some((role: string) =>
    ["chief", "responsable", "director", "regie"].includes(role),
  );
  const items =
    selected?.participant_ids ||
    s.entries.filter((e) => e.category_id === category).map((e) => e.id);
  if (!canDirect)
    return (
      <>
        <h1>Espace speaker</h1>
        <Panel title="Conduite du plateau">
          <p>
            Ouvrez la vue speaker pour suivre les appels et les prononciations.
          </p>
          <a
            className="button"
            href="/screen/speaker"
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir l’écran speaker
          </a>
        </Panel>
      </>
    );
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">DIFFUSION MANUELLE</p>
          <h1>Régie & écrans</h1>
        </div>
      </div>
      <div className="screen-links">
        {Object.entries(screens).map(([id, label]) => (
          <a key={id} href={"/screen/" + id} target="_blank" rel="noreferrer">
            <span>↗</span>
            {label}
            <small>Ouvrir dans une autre fenêtre</small>
          </a>
        ))}
      </div>
      <div className="split">
        <Panel title="Préparer la scène">
          <div className="form-grid">
            <Field label="Écran cible">
              <select
                value={screen}
                onChange={(e) => setScreen(e.target.value)}
              >
                {Object.entries(screens)
                  .filter(([id]) => id !== "speaker")
                  .map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Contenu">
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                {Object.entries(scenes).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Catégorie">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Aucune</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Manche">
              <select value={round} onChange={(e) => setRound(e.target.value)}>
                <option value="">
                  {!category
                    ? "Choisissez d’abord une catégorie"
                    : proposedRounds.length
                      ? "Aucune"
                      : VALIDATED_SCENES.includes(kind)
                        ? "Aucune manche validée pour cette catégorie"
                        : "Aucune manche pour cette catégorie"}
                </option>
                {proposedRounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.grand_final ? "Toutes disciplines" : labels[r.phase]} ·{" "}
                    {labels[r.status] || r.status}
                  </option>
                ))}
              </select>
            </Field>
            {kind === "official" && (
              <Field label="Officiel">
                <select
                  value={official}
                  onChange={(e) => setOfficial(e.target.value)}
                >
                  <option value="">Choisir…</option>
                  {s.officials.map((o) => (
                    <option key={o.id} value={o.id}>
                      {personName(o)} · {o.post}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {["reveal", "podium", "ranking", "qualifiers"].includes(kind) && (
              <Field label="Nombre de places révélées">
                <input
                  type="number"
                  min="0"
                  max={items.length}
                  value={revealed}
                  onChange={(e) => setRevealed(Number(e.target.value))}
                />
              </Field>
            )}
            <Field label="Athlète appelé">
              <select
                value={called}
                onChange={(e) => setCalled(e.target.value)}
              >
                <option value="">Aucun appel</option>
                {items.map((id) => (
                  <option key={id} value={id}>
                    {entryLabel(s, id)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {kind === "officials" && (
            <Multi
              title="Officiels dans la mosaïque"
              items={s.officials.map((o) => ({ ...o, name: personName(o) }))}
              value={officials}
              onChange={setOfficials}
            />
          )}
          <details>
            <summary>Positionner les athlètes sur le plateau</summary>
            {items.map((id) => (
              <Field key={id} label={entryLabel(s, id)}>
                <select
                  value={positions[id] || "line"}
                  onChange={(e) =>
                    setPositions({ ...positions, [id]: e.target.value })
                  }
                >
                  <option value="line">Ligne principale</option>
                  <option value="left">À gauche</option>
                  <option value="center">Au centre</option>
                  <option value="right">À droite</option>
                  <option value="waiting">En attente</option>
                </select>
              </Field>
            ))}
          </details>
          <Notice>
            La diffusion se fait uniquement sur votre action. Les photos doivent
            avoir été approuvées avec consentement. Aucun résultat n’est révélé
            automatiquement.
          </Notice>
          <AsyncButton
            allowed={canCommand(s.me.roles, "scene.set")}
            action={async () => {
              try {
                await command("scene.set", { screen, scene });
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Diffuser sur {screens[screen].toLowerCase()}
          </AsyncButton>
          {error && <Notice kind="error">{error}</Notice>}
        </Panel>
        <Panel title="Aperçu du contenu préparé">
          <div className="preview-label">APERÇU · PAS ENCORE DIFFUSÉ</div>
          <ScreenContent data={{ ...s, scene }} preview />
          <p className="muted">
            L’affichage public applique en plus les filtres et autorisations du
            serveur.
          </p>
        </Panel>
      </div>
      <Panel title="Scènes actuellement diffusées">
        <DataTable
          columns={["Écran", "Scène", "Catégorie"]}
          rows={Object.entries(s.public || {}).map(
            ([screen, scene]: [string, any]) => [
              screens[screen] || screen,
              scenes[(scene.scene || scene).kind] || "Accueil",
              s.categories.find(
                (c) => c.id === (scene.scene || scene).category_id,
              )?.name || "—",
            ],
          )}
        />
      </Panel>
    </>
  );
}
export function PublicScreen({ name }: { name: string }) {
  const [data, setData] = useState<any>(),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const load = () =>
      api(name === "speaker" ? "/state" : "/public/" + name)
        .then((d) => {
          if (live) {
            setData(
              name === "speaker"
                ? {
                    ...d,
                    scene: d.public?.backstage || {
                      kind: "category",
                      category_id: d.rounds?.find(
                        (r: any) => r.id === d.active_round_id,
                      )?.category_id,
                    },
                  }
                : d,
            );
            setError("");
          }
        })
        .catch((e) => live && setError(e.message));
    load();
    const timer = setInterval(load, 2000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [name]);
  return (
    <div className={"public-screen " + name}>
      <header>
        <img src="/assets/fibda-logo.jpg" alt="FIBDA" />
        <div>
          <p className="eyebrow">FÉDÉRATION IVOIRIENNE DE BODYBUILDING</p>
          <strong>{data?.name || "Compétition"}</strong>
        </div>
        <span>
          {screens[name]}
          {data?.demo ? " · DÉMONSTRATION" : ""}
        </span>
      </header>
      {error && (
        <Notice kind="error">
          Diffusion interrompue : {error}. Reconnexion automatique…
        </Notice>
      )}
      {data ? <ScreenContent data={data} /> : <p>Connexion à la régie…</p>}
      {name === "speaker" && data && (
        <Panel title="Conduite et prononciations">
          <DataTable
            columns={["Dossard", "Athlète", "Prononciation", "Club / pays"]}
            rows={(data.entries || [])
              .filter((e: Entity) =>
                projectionGroup(
                  data.entries || [],
                  data.scene?.scene || data.scene || {},
                  data.rounds?.find(
                    (r: Entity) =>
                      r.id === (data.scene?.scene || data.scene)?.round_id,
                  ),
                ).includes(e.id),
              )
              .map((e: Entity) => {
                const p = data.people.find((p: Entity) => p.id === e.person_id);
                return [
                  e.bib,
                  personName(p),
                  p?.pronunciation || "—",
                  `${p?.club || ""} / ${paysAvecDrapeau(p?.country)}`,
                ];
              })}
          />
        </Panel>
      )}
    </div>
  );
}
export function ScreenContent({
  data,
  preview = false,
}: {
  data: any;
  preview?: boolean;
}) {
  const scene = data.scene?.scene || data.scene || { kind: "idle" };
  const people: Entity[] = data.people || [];
  const entries: Entity[] = data.entries || [];
  const officials: Entity[] = data.officials || [];
  const category = data.categories?.find(
    (c: Entity) => c.id === scene.category_id,
  );
  const round = data.rounds?.find((r: Entity) => r.id === scene.round_id);
  const raw = round?.result?.official || round?.result?.common || [];
  const results: Array<any> = Array.isArray(raw) ? raw : [];
  const group = projectionGroup(entries, scene, round);
  const mode = photoMode(group.length);
  const sceneKey = `${data.restore_id || ""}:${scene.version || 0}:${scene.round_id || ""}:${scene.kind}`;
  const seen = useRef<string | undefined>(undefined);
  const [exiting, setExiting] = useState<string[]>([]);
  useEffect(() => {
    const animate =
      !preview && shouldAnimateScene(seen.current, sceneKey, scene.kind);
    seen.current = sceneKey;
    if (!animate) {
      setExiting([]);
      return;
    }
    setExiting(
      group.filter((id) => !(round?.result?.qualified || []).includes(id)),
    );
    const timer = setTimeout(() => setExiting([]), 1100);
    return () => clearTimeout(timer);
  }, [sceneKey, preview]);
  let ids = group;
  if (scene.kind === "qualifiers")
    ids = exiting.length ? group : round?.result?.qualified || [];
  if (["podium", "ranking", "reveal"].includes(scene.kind)) {
    ids = (
      preview && scene.kind === "reveal"
        ? [...results]
            .sort((a, b) => b.rank - a.rank)
            .slice(0, scene.revealed_count || 0)
        : preview && scene.kind === "podium"
          ? results.filter((r) => r.rank <= 3)
          : results
    ).map((r: any) => (typeof r === "string" ? r : r.entry_id || r.id));
  }
  if (scene.kind === "idle")
    return (
      <div className="screen-idle">
        <img src="/assets/fibda-logo.jpg" alt="FIBDA" />
        <h1>{data.name}</h1>
        <p>
          {data.mode === "national"
            ? "Championnat national"
            : "Compétition internationale"}
        </p>
        <p>Bienvenue · Welcome</p>
      </div>
    );
  if (["official", "officials"].includes(scene.kind)) {
    const selected = officials.filter((o) =>
      scene.kind === "official"
        ? o.id === scene.official_id
        : scene.official_ids?.includes(o.id),
    );
    return (
      <div className="screen-officials">
        {selected.map((o) => (
          <article key={o.id}>
            {o.photo_id &&
            ((!preview && !Array.isArray(o.approved_photo_ids)) ||
              (o.photo_approved &&
                o.photo_consent &&
                o.approved_photo_ids?.includes(o.photo_id))) ? (
              <img src={"/api/v1/photos/" + o.photo_id} alt={personName(o)} />
            ) : (
              <div className="photo-empty">FIBDA</div>
            )}
            <h2>{personName(o)}</h2>
            <p>{o.post}</p>
            <small>
              {o.organization} · {paysAvecDrapeau(o.country)}
            </small>
            <p>{o.pedigree}</p>
          </article>
        ))}
      </div>
    );
  }
  return (
    <>
      <div className="screen-title">
        <p className="eyebrow">{scenes[scene.kind] || "COMPÉTITION"}</p>
        <h1>{category?.name || "Plateau"}</h1>
        <p>
          {labels[category?.section]} {round && "· " + labels[round.phase]}
        </p>
      </div>
      {!ids.length ? (
        <Empty>La régie prépare la prochaine annonce.</Empty>
      ) : (
        <div
          className={
            "athlete-mosaic " +
            mode +
            (group.length > 40 ? " dense" : "") +
            (scene.kind === "podium" ? " podium" : "")
          }
          style={
            {
              "--mosaic-columns": Math.min(
                10,
                Math.ceil(Math.sqrt(Math.max(group.length, 1))),
              ),
            } as React.CSSProperties
          }
        >
          {ids.map((id: string, i: number) => {
            const entry = entries.find((e) => e.id === id);
            const p = people.find((p) => p.id === entry?.person_id);
            return (
              <article
                key={id}
                className={
                  (exiting.includes(id) ? "qualifier-exit " : "") +
                  (scene.called_entry_id === id ? "called " : "") +
                  (scene.positions?.[id] || "line")
                }
              >
                {photoFor(p, mode, preview) ? (
                  <img
                    src={"/api/v1/photos/" + photoFor(p, mode, preview)}
                    alt={personName(p)}
                  />
                ) : (
                  <div className="photo-empty">
                    <img src="/assets/fibda-embleme.png" alt="" />
                  </div>
                )}
                <div className="athlete-info">
                  {["podium", "ranking", "reveal"].includes(scene.kind) && (
                    <span className="placement">
                      {results.find((r) => (r.entry_id || r.id) === id)?.rank ||
                        i + 1}
                    </span>
                  )}
                  <strong className="bib-label">
                    {entry?.bib ? "N° " + entry.bib : ""}
                  </strong>
                  <h2>{personName(p)}</h2>
                  <p>
                    <ClubLogo logos={data.club_logos} club={p?.club} />
                    {p?.club} · {paysAvecDrapeau(p?.country)}
                  </p>
                  {scene.called_entry_id === id && (
                    <span className="badge">Appelé sur le plateau</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {preview && (
        <small>Les photos non autorisées sont remplacées par l’emblème.</small>
      )}
    </>
  );
}
/**
 * Logo du club (contrat du 24/09/2026) : `club_logos[nom exact du club]` = identifiant d'une photo
 * servie par /api/v1/photos/<id>. Sans entrée, rien ne s'affiche.
 */
export function ClubLogo({
  logos,
  club,
}: {
  logos?: Record<string, string> | null;
  club?: string | null;
}) {
  const id = club && logos ? logos[club] : "";
  if (!id) return null;
  return (
    <img
      className="club-logo"
      src={"/api/v1/photos/" + id}
      alt={club || ""}
      style={{ height: "1.4em", verticalAlign: "middle", marginRight: "0.4em" }}
    />
  );
}
export function Rewards({ s, command }: { s: State; command: Command }) {
  // Mode national (PO 24/09/2026) : aucun classement ni récompense « Meilleur pays ».
  const rewards = s.rewards.filter(
    (r) => s.mode !== "national" || r.kind !== "country",
  );
  const [discipline, setDiscipline] = useState(
    s.categories[0]?.discipline || "bodybuilding",
  );
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">CÉRÉMONIE</p>
          <h1>Récompenses & remises</h1>
        </div>
        <a
          className="button ghost"
          href="/api/v1/print/rewards"
          target="_blank"
          rel="noreferrer"
        >
          Imprimer la liste
        </a>
      </div>
      <Notice>
        Préparation et remise sont deux étapes distinctes. Clôturez chaque cycle
        seulement après la remise effective.
      </Notice>
      <div className="rewards-grid">
        {rewards.map((r) => (
          <Reward key={r.id} reward={r} s={s} command={command} />
        ))}
      </div>
      {!rewards.length && (
        <Panel>
          <Empty>
            Les récompenses apparaissent après la validation des résultats
            sportifs.
          </Empty>
        </Panel>
      )}
      <Panel title="Clôture des cycles de remise">
        <Field label="Discipline">
          <select
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value)}
          >
            {Array.from(new Set(s.categories.map((c) => c.discipline))).map(
              (d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ),
            )}
          </select>
        </Field>
        <div className="actions">
          <AsyncButton
            allowed={canCommand(s.me.roles, "rewards.complete")}
            action={() =>
              command("rewards.complete", { discipline, kind: "category" })
            }
          >
            Confirmer les remises des catégories
          </AsyncButton>
          <AsyncButton
            allowed={canCommand(s.me.roles, "rewards.complete")}
            action={() =>
              command("rewards.complete", { discipline, kind: "overall" })
            }
          >
            Confirmer les remises toutes catégories
          </AsyncButton>
          <AsyncButton
            allowed={canCommand(s.me.roles, "discipline.advance")}
            className="ghost"
            action={() => command("discipline.advance", { discipline })}
          >
            Terminer cette discipline
          </AsyncButton>
        </div>
      </Panel>
    </>
  );
}
function Reward({
  reward: r,
  s,
  command,
}: {
  reward: Entity;
  s: State;
  command: Command;
}) {
  const [f, setF] = useState(r);
  return (
    <Panel title={r.title || "Récompense"}>
      <p>
        <strong>
          {r.entry_id
            ? entryLabel(s, r.entry_id)
            : r.collective_name || r.winner || ""}
        </strong>
      </p>
      <div className="form-grid">
        {[
          ["title", "Intitulé"],
          ["trophy", "Trophée"],
          ["medal", "Médaille"],
          ["lot", "Lot"],
          ["prize", "Prime"],
          ["currency", "Devise"],
        ].map(([k, label]) => (
          <Field key={k} label={label}>
            <input
              value={f[k] ?? ""}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}
            />
          </Field>
        ))}
      </div>
      <Check
        label="Récompense préparée"
        value={!!f.prepared}
        onChange={(v) => setF({ ...f, prepared: v })}
      />
      <Check
        label="Récompense remise"
        value={!!f.delivered}
        onChange={(v) => setF({ ...f, delivered: v })}
      />
      <AsyncButton
        allowed={canCommand(s.me.roles, "reward.update")}
        action={() =>
          command("reward.update", {
            reward_id: r.id,
            ...Object.fromEntries(
              [
                "title",
                "trophy",
                "medal",
                "lot",
                "prize",
                "currency",
                "prepared",
                "delivered",
              ].map((k) => [k, f[k]]),
            ),
          })
        }
      >
        Enregistrer la remise
      </AsyncButton>
    </Panel>
  );
}
