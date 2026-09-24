import { drapeau, paysAvecDrapeau } from "./pays";
import { canCommand } from "./permissions";
import {
  choisirCategorie,
  confirmationPossible,
  ficheComplete,
  fusionCompatible,
  inscriptionTardiveRequise,
  nomFusionParDefaut,
  type Choix,
  type Proposition,
} from "./categorieAuto";
import { useEffect, useState, type FormEvent } from "react";
import { api, post, download } from "./api";
import {
  type State,
  type Command,
  type Entity,
  uid,
  personName,
  labels,
} from "./types";
import {
  Field,
  Panel,
  Check,
  Multi,
  DataTable,
  AsyncButton,
  Notice,
  Status,
  JsonDetails,
} from "./ui";
type Props = { s: State; command: Command; refresh: () => Promise<void> };
const sections = [
  "Événement",
  "Athlètes",
  "Mesures",
  "Catégories",
  "Programme",
  "Officiels",
  "Jury",
  "Documents",
];
export function Preparation(p: Props) {
  const [tab, setTab] = useState("Événement");
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">AVANT LE PLATEAU</p>
          <h1>Préparation</h1>
        </div>
        <Status value={p.s.status} />
      </div>
      <nav className="subnav" aria-label="Rubriques préparation">
        {sections.map((x) => (
          <button
            className={tab === x ? "active" : "ghost"}
            key={x}
            onClick={() => setTab(x)}
          >
            {x}
          </button>
        ))}
      </nav>
      {tab === "Événement" ? (
        <EventForm {...p} />
      ) : tab === "Athlètes" ? (
        <People {...p} />
      ) : tab === "Mesures" ? (
        <Measures {...p} />
      ) : tab === "Catégories" ? (
        <Categories {...p} />
      ) : tab === "Programme" ? (
        <Programme {...p} />
      ) : tab === "Officiels" ? (
        <Officials {...p} />
      ) : tab === "Jury" ? (
        <Jury {...p} />
      ) : (
        <Documents {...p} />
      )}
    </>
  );
}
function EventForm({ s, command }: Props) {
  const [f, setF] = useState({
    name: s.name,
    date: s.date,
    location: s.location,
    mode: s.mode,
    regulations_checked: !!s.settings.regulations_checked,
    network_checked: !!s.settings.network_checked,
    backup_checked: !!s.settings.backup_checked,
    backup_directory: s.settings.backup_directory || "",
    collective_tiebreak: s.settings.collective_tiebreak || "",
  });
  useEffect(() => setF((current) => ({ ...current, mode: s.mode })), [s.mode]);
  return (
    <Panel title="Identité de la compétition">
      {canCommand(s.me.roles, "event.update") ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            command("event.update", {
              name: f.name,
              date: f.date,
              location: f.location,
              mode: f.mode,
              ...(canCommand(s.me.roles, "event.start")
                ? {
                    settings: {
                      ...s.settings,
                      regulations_checked: f.regulations_checked,
                      network_checked: f.network_checked,
                      backup_checked: f.backup_checked,
                      backup_directory: f.backup_directory,
                      collective_tiebreak: f.collective_tiebreak,
                    },
                  }
                : {}),
            }).catch(() => {});
          }}
        >
          <div className="form-grid">
            <Field label="Nom">
              <input
                required
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                required
                value={f.date}
                disabled={s.status !== "preparation"}
                onChange={(e) => setF({ ...f, date: e.target.value })}
              />
            </Field>
            <Field label="Lieu">
              <input
                value={f.location}
                onChange={(e) => setF({ ...f, location: e.target.value })}
              />
            </Field>
            <Field label="Mode">
              <select
                value={f.mode}
                disabled={s.status !== "preparation"}
                onChange={(e) => setF({ ...f, mode: e.target.value })}
              >
                <option value="national">
                  National · classement officiel ivoirien
                </option>
                <option value="international">
                  International · délégations approuvées
                </option>
              </select>
            </Field>
          </div>
          {canCommand(s.me.roles, "event.start") && (
            <>
              {" "}
              <Check
                label="Le référentiel applicable et ses réserves ont été vérifiés par l’organisation"
                value={f.regulations_checked}
                onChange={(v) => setF({ ...f, regulations_checked: v })}
              />
              <Check
                label="Réseau local et accès des appareils contrôlés"
                value={f.network_checked}
                onChange={(v) => setF({ ...f, network_checked: v })}
              />
              <Check
                label="Sauvegarde de départ réalisée et contrôlée"
                value={f.backup_checked}
                onChange={(v) => setF({ ...f, backup_checked: v })}
              />
              <Field label="Dossier de sauvegarde sur l’ordinateur serveur">
                <input
                  value={f.backup_directory}
                  onChange={(e) =>
                    setF({ ...f, backup_directory: e.target.value })
                  }
                  placeholder="Chemin du dossier sur le support externe"
                />
                <small>
                  Chemin du support raccordé à l’ordinateur serveur, pas à ce
                  téléphone.
                </small>
              </Field>
              <Field label="Critère collectif publié de départage">
                <textarea
                  required
                  value={f.collective_tiebreak}
                  onChange={(e) =>
                    setF({ ...f, collective_tiebreak: e.target.value })
                  }
                />
              </Field>
            </>
          )}{" "}
          <div className="actions">
            <button>Enregistrer l’événement</button>
            <AsyncButton
              allowed={canCommand(s.me.roles, "event.start")}
              disabled={s.status !== "preparation"}
              action={() => command("event.start")}
            >
              Démarrer la compétition
            </AsyncButton>
            <AsyncButton
              allowed={canCommand(s.me.roles, "event.finish")}
              className="ghost"
              disabled={s.status !== "running"}
              action={() => command("event.finish")}
            >
              Terminer la compétition
            </AsyncButton>
          </div>
        </form>
      ) : (
        <Notice>Consultation uniquement pour votre rôle.</Notice>
      )}
      <Notice>
        Référentiel : {s.rules_version || s.catalogue_version}. Le mode national
        filtre les titres sur la nationalité CI, indépendamment du pays
        représenté.
      </Notice>
    </Panel>
  );
}
const personDefault = (): Entity => ({
  id: uid(),
  first_name: "",
  last_name: "",
  birth_date: "",
  sex: "M",
  nationalities: ["CI"],
  country: "CI",
  club: "",
  section: "amateur",
  status_approved: false,
  delegation_approved: false,
  organizer_approved: false,
  licence_ok: false,
  payment_ok: false,
  minor_authorization: false,
  height_cm: "",
  weight_kg: "",
  measurements_confirmed: false,
  photo_consent: false,
  photo_approved: false,
  private_contact: "",
  pronunciation: "",
});
// Une seule fiche athlète : identité, contrôles, taille et poids, puis catégorie proposée
// automatiquement par le référentiel à l'enregistrement (module pur categorieAuto.ts).
// Les règles d'admission restent celles du serveur (preparation.ts) : les messages serveur
// sont affichés tels quels.
type MessageFiche = { kind: "success" | "warning" | "error"; text: string };
const CONTROLES_CONFIRMATION =
  "« Statut approuvé », « Licence contrôlée », « Paiement reçu » et « Mesures confirmées »";
function People({ s, command, refresh }: Props) {
  const [person, setPerson] = useState<Entity>(personDefault);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [choix, setChoix] = useState<Choix>();
  const [derogation, setDerogation] = useState("");
  const [reason, setReason] = useState("Inscription tardive");
  const [message, setMessage] = useState<MessageFiche>();
  const update = (k: string, v: any) => setPerson({ ...person, [k]: v });
  const existing = s.people.some((p) => p.id === person.id);
  const chief = s.me.roles.includes("chief");
  const tardif = inscriptionTardiveRequise(s);
  const peutInscrireTardif = canCommand(s.me.roles, "entry.late");
  const peutCreerCategorie = canCommand(s.me.roles, "category.save") && !s.bibs_distributed;
  const inscriptions = s.entries.filter((e) => e.person_id === person.id);
  const nomCategorie = (id: string) =>
    s.categories.find((c) => c.id === id)?.name ?? "la catégorie choisie";
  const categoriesActives = s.categories.filter((c) => !c.archived);

  function ouvrir(p: Entity) {
    setPerson({ ...personDefault(), ...p });
    setChoix(undefined);
    setCategory("");
    setMessage(undefined);
  }

  /** Crée la catégorie de l'événement pour une règle du référentiel et renvoie son identifiant. */
  async function creerCategorie(ruleId: string): Promise<string> {
    const r = await command("category.save", {
      category: { id: uid(), rule_id: ruleId, section: person.section },
    });
    return r.result?.id ?? "";
  }

  async function propositionsServeur(personId: string): Promise<Proposition[]> {
    const r = await api("/eligibility/" + personId);
    return Array.isArray(r.proposals) ? r.proposals : [];
  }

  /**
   * Crée ou déplace l'inscription de la fiche enregistrée dans la catégorie cible.
   * Avant les dossards : `entry.save`, confirmée si les contrôles sont cochés, sinon brouillon.
   * Après les dossards ou compétition démarrée : `entry.late` (chef et responsable).
   */
  async function inscrire(saved: Entity, cible: string): Promise<void> {
    const miennes = s.entries.filter((e) => e.person_id === saved.id);
    if (miennes.some((e) => e.category_id === cible)) {
      setMessage({ kind: "success", text: "Fiche enregistrée. Inscription déjà présente dans " + nomCategorie(cible) + "." });
      return;
    }
    const derog = chief && derogation.trim() ? { reason: derogation.trim() } : undefined;
    if (tardif) {
      if (!peutInscrireTardif) {
        setMessage({
          kind: "warning",
          text: "Fiche enregistrée. Les dossards sont attribués : l'inscription tardive dans " + nomCategorie(cible) + " est réservée au chef et au responsable.",
        });
        return;
      }
      const r = await command("entry.late", { person: saved, category_id: cible, reason, derogation: derog });
      setMessage({
        kind: "success",
        text: "Inscription tardive enregistrée dans " + nomCategorie(cible) + (r.result?.bib ? ", dossard n° " + r.result.bib : "") + ".",
      });
      return;
    }
    const sansDossard = miennes.find((e) => !e.bib);
    const confirmee = confirmationPossible(saved, s.mode);
    const base = sansDossard
      ? { ...sansDossard, category_id: cible, confirmed: confirmee, derogation: derog ?? sansDossard.derogation ?? null }
      : { id: uid(), person_id: saved.id, category_id: cible, confirmed: confirmee, bib: null, derogation: derog ?? null };
    const brouillon = "Inscription en brouillon dans " + nomCategorie(cible) + " : cochez " + CONTROLES_CONFIRMATION + " puis touchez « Confirmer l'inscription ».";
    try {
      await command("entry.save", { entry: base });
      setMessage(
        confirmee
          ? { kind: "success", text: "Inscription confirmée dans " + nomCategorie(cible) + "." }
          : { kind: "warning", text: brouillon },
      );
    } catch (e) {
      if (!confirmee) throw e;
      // Le serveur refuse la confirmation (motif affiché) : l'inscription reste en brouillon.
      await command("entry.save", { entry: { ...base, confirmed: false, derogation: null } });
      setMessage({ kind: "warning", text: brouillon + " Refus de confirmation par le serveur : " + (e as Error).message });
    }
  }

  async function enregistrer() {
    setMessage(undefined);
    const saved: Entity = { ...person, ...((await command("person.save", { person })).result ?? {}) };
    // Le serveur remet « mesures confirmées » à faux quand la taille ou le poids d'une fiche
    // existante change : la confirmation cochée passe alors par measurement.save.
    if (person.measurements_confirmed && person.height_cm && person.weight_kg && !saved.measurements_confirmed) {
      const r = await command("measurement.save", { person_id: saved.id, height_cm: person.height_cm, weight_kg: person.weight_kg });
      Object.assign(saved, r.result ?? { measurements_confirmed: true });
    }
    setPerson({ ...personDefault(), ...saved });
    let cible = category;
    if (!cible && ficheComplete(saved)) {
      const proposition = choisirCategorie(await propositionsServeur(saved.id), s.categories, saved.section);
      setChoix(proposition);
      if (proposition.category_id) cible = proposition.category_id;
      else if (proposition.rule_id) {
        if (peutCreerCategorie) cible = await creerCategorie(proposition.rule_id);
        else {
          setMessage({
            kind: "warning",
            text: "Fiche enregistrée. " + proposition.message + " Aucune catégorie n'a été créée : " + (s.bibs_distributed ? "les catégories sont figées après attribution des dossards" : "la création est réservée au chef et au responsable") + ". Choisissez une catégorie existante dans « Sélectionner une catégorie » puis touchez « Enregistrer ».",
          });
          return;
        }
      } else {
        setMessage({ kind: "warning", text: "Fiche enregistrée. " + proposition.message });
        return;
      }
      setCategory(cible);
    }
    if (!cible) {
      setMessage({
        kind: "warning",
        text: "Fiche enregistrée sans inscription : renseignez sexe, date de naissance, taille et poids pour une catégorie automatique, ou choisissez une catégorie dans « Sélectionner une catégorie » puis touchez « Enregistrer ».",
      });
      return;
    }
    await inscrire(saved, cible);
  }

  return (
    <>
      <div className="split">
        <Panel title={existing ? "Modifier une fiche athlète" : "Nouvelle fiche athlète"}>
          {tardif && (
            <Notice kind="warning">
              {s.bibs_distributed ? "Dossards attribués" : "Compétition démarrée"} : chaque
              nouvelle inscription est enregistrée comme inscription tardive (chef et
              responsable), avec un nouveau dossard, tant que la catégorie n'a pas commencé.
            </Notice>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enregistrer().catch((err) => setMessage({ kind: "error", text: (err as Error).message }));
            }}
          >
            <div className="form-grid">
              {[
                ["first_name", "Prénom"],
                ["last_name", "Nom"],
                ["birth_date", "Date de naissance"],
                ["club", "Club"],
                ["country", "Pays représenté"],
                ["private_contact", "Contact privé"],
                ["pronunciation", "Prononciation speaker"],
              ].map(([k, label]) => (
                <Field label={label} key={k}>
                  <input
                    required={[
                      "first_name",
                      "last_name",
                      "birth_date",
                    ].includes(k)}
                    type={k === "birth_date" ? "date" : "text"}
                    value={person[k] || ""}
                    onChange={(e) => update(k, e.target.value)}
                  />
                </Field>
              ))}
              <Field label="Nationalités (codes séparés par virgule)">
                <span className="drapeaux" aria-hidden="true">
                  {(person.nationalities ?? []).map((c: string) => drapeau(c)).join(" ")}
                </span>
                <input
                  value={person.nationalities?.join(", ")}
                  onChange={(e) =>
                    update(
                      "nationalities",
                      e.target.value
                        .toUpperCase()
                        .split(",")
                        .map((x) => x.trim()),
                    )
                  }
                />
              </Field>
              <Field label="Sexe">
                <select
                  value={person.sex}
                  onChange={(e) => update("sex", e.target.value)}
                >
                  <option value="M">Homme</option>
                  <option value="F">Femme</option>
                </select>
              </Field>
              <Field label="Section">
                <select
                  value={person.section}
                  onChange={(e) => update("section", e.target.value)}
                >
                  <option value="amateur">Amateur</option>
                  <option value="pro">Professionnel</option>
                </select>
              </Field>
              <Field label="Taille (cm)" hint="Une décimale au plus, ex. 172.5">
                <input
                  inputMode="decimal"
                  value={person.height_cm || ""}
                  onChange={(e) => update("height_cm", e.target.value)}
                />
              </Field>
              <Field label="Poids (kg) — pesée" hint="Une décimale au plus, ex. 69.5">
                <input
                  inputMode="decimal"
                  value={person.weight_kg || ""}
                  onChange={(e) => update("weight_kg", e.target.value)}
                />
              </Field>
            </div>
            <div className="checks">
              {[
                ["status_approved", "Statut approuvé"],
                ["licence_ok", "Licence contrôlée"],
                ["payment_ok", "Paiement reçu"],
                ["measurements_confirmed", "Mesures confirmées (taille et poids contrôlés)"],
                ["minor_authorization", "Autorisation du mineur"],
                [
                  "crossover_approved",
                  "Crossover Junior/Masters vers Senior autorisé par le chef",
                ],
                ["delegation_approved", "Délégation approuvée"],
                ["organizer_approved", "Organisation approuvée"],
              ].map(([k, label]) => (
                <Check
                  key={k}
                  label={label}
                  value={person[k]}
                  onChange={(v) => update(k, v)}
                />
              ))}
            </div>
            <Field
              label="Sélectionner une catégorie"
              hint="Laissez « Catégorie proposée automatiquement » : à l'enregistrement, le référentiel propose la catégorie d'après sexe, âge, taille et poids, et la crée si elle n'existe pas. Choisissez-en une pour l'imposer ; une inscription sans dossard est déplacée."
            >
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Catégorie proposée automatiquement</option>
                {categoriesActives.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {labels[c.section]}
                  </option>
                ))}
              </select>
            </Field>
            {chief && (
              <Field
                label="Motif de dérogation, réservé au chef (facultatif)"
                hint="Nécessaire pour confirmer une inscription hors critères (âge ou mesures hors catégorie, contrôle manquant). Signée du chef et conservée avec ses motifs."
              >
                <input
                  value={derogation}
                  onChange={(e) => setDerogation(e.target.value)}
                />
              </Field>
            )}
            {tardif && peutInscrireTardif && (
              <Field label="Motif d'inscription tardive">
                <input
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
            )}
            <div className="actions">
              <button>Enregistrer</button>
              <button
                type="button"
                className="ghost"
                onClick={() => ouvrir(personDefault())}
              >
                Nouvelle fiche
              </button>
              {existing && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() =>
                    propositionsServeur(person.id)
                      .then((props) => {
                        setChoix(choisirCategorie(props, s.categories, person.section));
                        setMessage(undefined);
                      })
                      .catch((e) => setMessage({ kind: "error", text: e.message }))
                  }
                >
                  Vérifier les catégories proposées
                </button>
              )}
            </div>
          </form>
          {message && <Notice kind={message.kind}>{message.text}</Notice>}
          {choix && (
            <section className="propositions">
              <h3>Catégories proposées par le référentiel</h3>
              <p className="muted">{choix.message}</p>
              {choix.alternatives.map((a) => (
                <div className="entry-row" key={a.rule_id}>
                  <strong>{a.nom}</strong>
                  <small>
                    {a.category_id ? "Catégorie existante" : "Catégorie à créer"}
                    {a.motifs.length > 0 ? " · " + a.motifs.join(" ") : ""}
                  </small>
                  {existing && a.category_id && (
                    <AsyncButton
                      className="ghost"
                      allowed={canCommand(s.me.roles, tardif ? "entry.late" : "entry.save")}
                      action={async () => {
                        setCategory(a.category_id!);
                        await inscrire(person, a.category_id!).catch((e) => setMessage({ kind: "error", text: e.message }));
                      }}
                    >
                      Inscrire dans {nomCategorie(a.category_id)}
                    </AsyncButton>
                  )}
                  {existing && !a.category_id && (
                    <AsyncButton
                      className="ghost"
                      allowed={canCommand(s.me.roles, "category.save")}
                      disabled={s.bibs_distributed}
                      action={async () => {
                        try {
                          const id = await creerCategorie(a.rule_id);
                          setCategory(id);
                          await inscrire(person, id);
                        } catch (e) {
                          setMessage({ kind: "error", text: (e as Error).message });
                        }
                      }}
                    >
                      Créer la catégorie {a.nom}
                    </AsyncButton>
                  )}
                </div>
              ))}
              {s.bibs_distributed && choix.alternatives.some((a) => !a.category_id) && (
                <small className="muted">Catégories figées après attribution des dossards : seules les catégories existantes peuvent recevoir une inscription.</small>
              )}
            </section>
          )}
          {existing && (
            <>
              <h3>Inscriptions de cette personne</h3>
              <p className="muted">
                Confirmez après les contrôles et les mesures. Déconfirmez avant
                une correction incompatible. Pour changer de catégorie avant les
                dossards : choisissez-la dans « Sélectionner une catégorie » puis
                « Enregistrer ».
              </p>
              {inscriptions.map((entry) => (
                <div className="entry-row" key={entry.id}>
                  <strong>{nomCategorie(entry.category_id)}</strong>
                  <small>
                    {entry.bib ? "N° " + entry.bib : "Sans dossard"} ·{" "}
                    {entry.confirmed
                      ? "Inscription confirmée"
                      : "À contrôler"}
                    {entry.late_reason ? " · tardive : " + entry.late_reason : ""}
                  </small>
                  <AsyncButton
                    allowed={canCommand(s.me.roles, "entry.save")}
                    className="ghost"
                    action={() =>
                      command("entry.save", {
                        entry: {
                          ...entry,
                          confirmed: !entry.confirmed,
                          derogation: derogation
                            ? { reason: derogation }
                            : entry.derogation,
                        },
                      })
                    }
                  >
                    {entry.confirmed
                      ? "Déconfirmer"
                      : "Confirmer l'inscription"}
                  </AsyncButton>
                </div>
              ))}
              {inscriptions.length === 0 && <p className="muted">Sans inscription.</p>}
            </>
          )}{" "}
          {existing && (
            <PhotoUpload owner={person} ownerType="person" refresh={refresh} />
          )}
        </Panel>
        <Panel title={`${s.people.length} personnes`}>
          <Field label="Rechercher">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, club…"
            />
          </Field>
          <div className="person-list">
            {s.people
              .filter((p) =>
                (personName(p) + " " + p.club)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((p) => (
                <button
                  key={p.id}
                  className="person-row ghost"
                  onClick={() => ouvrir(p)}
                >
                  <span className="avatar">
                    {p.photo_portrait ? (
                      <img src={"/api/v1/photos/" + p.photo_portrait} alt="" />
                    ) : (
                      p.first_name?.[0]
                    )}
                  </span>
                  <span>
                    <strong>{personName(p)}</strong>
                    <small>
                      {p.club || "Sans club"} · {paysAvecDrapeau(p.country)} ·{" "}
                      {labels[p.section]}
                      {p.height_cm || p.weight_kg
                        ? ` · ${p.height_cm || "?"} cm / ${p.weight_kg || "?"} kg${p.measurements_confirmed ? "" : " (à confirmer)"}`
                        : " · mesures absentes"}
                    </small>
                    <small>
                      {s.entries
                        .filter((e) => e.person_id === p.id)
                        .map(
                          (e) =>
                            `${e.bib ? "N° " + e.bib : "Sans dossard"} ${s.categories.find((c) => c.id === e.category_id)?.name}`,
                        )
                        .join(" / ") || "Sans inscription"}
                    </small>
                  </span>
                </button>
              ))}
          </div>
        </Panel>
      </div>
      <ImportPanel refresh={refresh} />
      <BatchPhotos s={s} refresh={refresh} />
    </>
  );
}
function Measures({ s, command }: Props) {
  const [edited, setEdited] = useState<
    Record<string, { height_cm: string; weight_kg: string }>
  >({});
  return (
    <Panel title="Contrôle des tailles et des poids">
      <Notice>
        Les mesures sont contrôlées et confirmées ensemble. Les propositions du
        référentiel ne remplacent pas l’admission par l’organisation.
      </Notice>
      <DataTable
        columns={["Athlète", "Taille (cm)", "Poids (kg)", "Contrôle"]}
        rows={s.people.map((p) => {
          const f = edited[p.id] || {
            height_cm: p.height_cm || "",
            weight_kg: p.weight_kg || "",
          };
          return [
            <strong>{personName(p)}</strong>,
            <input
              aria-label={"Taille de " + personName(p)}
              inputMode="decimal"
              value={f.height_cm}
              onChange={(e) =>
                setEdited({
                  ...edited,
                  [p.id]: { ...f, height_cm: e.target.value },
                })
              }
            />,
            <input
              aria-label={"Poids de " + personName(p)}
              inputMode="decimal"
              value={f.weight_kg}
              onChange={(e) =>
                setEdited({
                  ...edited,
                  [p.id]: { ...f, weight_kg: e.target.value },
                })
              }
            />,
            <>
              <Status
                value={p.measurements_confirmed ? "Contrôlé" : "À contrôler"}
              />
              <AsyncButton
                allowed={canCommand(s.me.roles, "measurement.save")}
                action={() =>
                  command("measurement.save", { person_id: p.id, ...f })
                }
              >
                Confirmer
              </AsyncButton>
            </>,
          ];
        })}
      />
    </Panel>
  );
}
function Categories({ s, command }: Props) {
  const [catalogue, setCatalogue] = useState<any>({ rules: [] });
  useEffect(() => {
    api("/catalogue")
      .then(setCatalogue)
      .catch(() => {});
  }, []);
  const [cat, setCat] = useState<Entity>({
    id: uid(),
    name: "",
    discipline: "bodybuilding",
    sex: "M",
    section: "amateur",
    division: "senior",
    rule_id: "",
    quota: 6,
    elimination_quota: 15,
    order: s.categories.length,
    entry_ids: [],
    merged_from: [],
    archived: false,
  });
  const [merge, setMerge] = useState<string[]>([]);
  const [mergeName, setMergeName] = useState("");
  return (
    <div className="split">
      <Panel title="Catégorie et référentiel">
        {canCommand(s.me.roles, "category.save") ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await command("category.save", { category: cat }).catch(() => {});
            }}
          >
            <Field label="Règle du catalogue">
              <select
                required
                value={cat.rule_id}
                onChange={(e) => {
                  const rule = catalogue.rules.find(
                    (r: any) => r.id === e.target.value,
                  );
                  if (rule)
                    setCat({
                      ...cat,
                      rule_id: rule.id,
                      name: rule.name,
                      discipline: rule.discipline,
                      sex: rule.sex,
                      division: rule.division,
                      age_min: rule.age_min,
                      age_max: rule.age_max,
                    });
                }}
              >
                <option value="">Choisir une règle vérifiable…</option>
                {(catalogue.rules || []).map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.division} · {r.id}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Nom affiché">
                <input
                  required
                  value={cat.name}
                  onChange={(e) => setCat({ ...cat, name: e.target.value })}
                />
              </Field>
              <Field label="Section">
                <select
                  value={cat.section}
                  onChange={(e) => setCat({ ...cat, section: e.target.value })}
                >
                  <option value="amateur">Amateur</option>
                  <option value="pro">Professionnel</option>
                </select>
              </Field>
              <Field label="Première phase">
                <select
                  value={cat.phase_override || ""}
                  onChange={(e) =>
                    setCat({ ...cat, phase_override: e.target.value || null })
                  }
                >
                  <option value="">Automatique selon l’effectif</option>
                  <option value="elimination">Éliminatoires</option>
                  <option value="semi">Demi-finale</option>
                  <option value="final">Finale directe</option>
                </select>
              </Field>
              <Field label="Places en finale">
                <input
                  type="number"
                  min="1"
                  value={cat.quota}
                  onChange={(e) =>
                    setCat({ ...cat, quota: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Quota éliminatoire">
                <input
                  type="number"
                  min="1"
                  value={cat.elimination_quota}
                  onChange={(e) =>
                    setCat({
                      ...cat,
                      elimination_quota: Number(e.target.value),
                    })
                  }
                />
              </Field>
            </div>
            <div className="actions">
              <button>Enregistrer la catégorie</button>
              <button
                className="ghost"
                type="button"
                onClick={() =>
                  setCat({
                    ...cat,
                    id: uid(),
                    name: "",
                    entry_ids: [],
                    merged_from: [],
                  })
                }
              >
                Nouvelle catégorie
              </button>
            </div>
          </form>
        ) : (
          <Notice>Consultation uniquement pour votre rôle.</Notice>
        )}
        <small>
          Catalogue {catalogue.version}. {catalogue.scope}
        </small>
      </Panel>
      <Panel title="Catégories engagées">
        <DataTable
          columns={["Catégorie", "Inscrits", "Action"]}
          rows={s.categories
            .filter((c) => !c.archived)
            .map((c) => [
              <>
                <strong>{c.name}</strong>
                <small>
                  {labels[c.section]} · {c.division}
                </small>
              </>,
              s.entries.filter((e) => e.category_id === c.id).length,
              <button className="ghost" onClick={() => setCat(c)}>
                Modifier
              </button>,
            ])}
        />
        {canCommand(s.me.roles, "category.fuse") && (
          <section className="fusion">
            <h3>Fusion de catégories (chef, avant attribution des dossards)</h3>
            <p className="muted">
              Réunit plusieurs catégories de même discipline, sexe, section et
              groupe d'âge (par exemple deux tranches de poids trop peu
              fournies) en une seule ; les inscriptions sont réaffectées, les
              catégories d'origine archivées. Règle serveur : « Fusion
              incompatible : discipline, sexe, section et groupe d'âge doivent
              correspondre. » et « Fusion interdite après attribution des
              dossards. »
            </p>
            {s.bibs_distributed ? (
              <Notice kind="warning">Fusion interdite après attribution des dossards.</Notice>
            ) : (
              <>
                <fieldset>
                  <legend>Catégories à fusionner (au moins deux)</legend>
                  <div className="checks">
                    {s.categories
                      .filter((c) => !c.archived)
                      .map((c) => (
                        <Check
                          key={c.id}
                          label={`${c.name} · ${c.sex === "F" ? "Femmes" : "Hommes"} · ${labels[c.section]} · ${c.division}${c.age_min !== null && c.age_min !== undefined ? " " + c.age_min : ""}${c.age_max !== null && c.age_max !== undefined ? "–" + c.age_max : ""} · ${s.entries.filter((e) => e.category_id === c.id).length} inscrit(s)`}
                          value={merge.includes(c.id)}
                          onChange={(v) =>
                            setMerge(v ? [...merge, c.id] : merge.filter((id) => id !== c.id))
                          }
                        />
                      ))}
                  </div>
                </fieldset>
                {merge.length >= 2 && !fusionCompatible(s.categories.filter((c) => merge.includes(c.id))) && (
                  <Notice kind="error">
                    Fusion incompatible : discipline, sexe, section et groupe d'âge doivent correspondre.
                  </Notice>
                )}
                <Field
                  label="Nom de la catégorie fusionnée"
                  hint="Laissé vide, le serveur enchaîne les noms d'origine."
                >
                  <input
                    value={mergeName}
                    placeholder={nomFusionParDefaut(s.categories.filter((c) => merge.includes(c.id)))}
                    onChange={(e) => setMergeName(e.target.value)}
                  />
                </Field>
                <AsyncButton
                  allowed={canCommand(s.me.roles, "category.fuse")}
                  disabled={
                    merge.length < 2 ||
                    !fusionCompatible(s.categories.filter((c) => merge.includes(c.id)))
                  }
                  action={async () => {
                    await command("category.fuse", {
                      category_ids: merge,
                      ...(mergeName.trim() ? { name: mergeName.trim() } : {}),
                    });
                    setMerge([]);
                    setMergeName("");
                  }}
                >
                  Fusionner les catégories sélectionnées
                </AsyncButton>
              </>
            )}
          </section>
        )}
      </Panel>
    </div>
  );
}
function Programme({ s, command }: Props) {
  const cats = [...s.categories]
    .filter((c) => !c.archived)
    .sort((a, b) => a.order - b.order);
  async function move(index: number, delta: number) {
    const ids = cats.map((c) => c.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    await command("programme.reorder", { category_ids: ids });
  }
  return (
    <>
      <Panel
        title="Ordre de passage"
        actions={
          <div className="actions">
            <AsyncButton
              allowed={canCommand(s.me.roles, "bibs.assign")}
              disabled={s.bibs_distributed}
              action={() => command("bibs.assign")}
            >
              Attribuer les dossards
            </AsyncButton>
            <AsyncButton
              allowed={canCommand(s.me.roles, "programme.generate")}
              action={() => command("programme.generate")}
            >
              Générer les manches
            </AsyncButton>
          </div>
        }
      >
        <DataTable
          columns={["Ordre", "Catégorie", "Inscrits", "Déplacer"]}
          rows={cats.map((c, i) => [
            i + 1,
            <>
              <strong>{c.name}</strong>
              <small>{labels[c.section]}</small>
            </>,
            s.entries.filter((e) => e.category_id === c.id).length,
            <div className="actions">
              <AsyncButton
                className="ghost"
                disabled={i === 0}
                allowed={canCommand(s.me.roles, "programme.reorder")}
                action={() => move(i, -1)}
              >
                ↑
              </AsyncButton>
              <AsyncButton
                className="ghost"
                disabled={i === cats.length - 1}
                allowed={canCommand(s.me.roles, "programme.reorder")}
                action={() => move(i, 1)}
              >
                ↓
              </AsyncButton>
            </div>,
          ])}
        />
      </Panel>
      <Panel title="Manches prévues">
        <DataTable
          columns={["Catégorie", "Phase", "Athlètes", "État"]}
          rows={s.rounds.map((r) => [
            s.categories.find((c) => c.id === r.category_id)?.name,
            labels[r.phase],
            r.participant_ids.length,
            <Status value={r.status} />,
          ])}
        />
      </Panel>
    </>
  );
}
function Officials({ s, command, refresh }: Props) {
  const blank = () => ({
    id: uid(),
    first_name: "",
    last_name: "",
    post: "",
    organization: "",
    country: "CI",
    pedigree: "",
    photo_id: null,
    photo_consent: false,
    photo_approved: false,
  });
  const [f, setF] = useState<Entity>(blank);
  return (
    <div className="split">
      <Panel title="Profil officiel">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            command("official.save", { official: f }).catch(() => {});
          }}
        >
          <div className="form-grid">
            {[
              ["first_name", "Prénom"],
              ["last_name", "Nom"],
              ["post", "Fonction"],
              ["organization", "Organisation"],
              ["country", "Pays"],
            ].map(([k, label]) => (
              <Field key={k} label={label}>
                <input
                  required={k === "last_name"}
                  value={f[k]}
                  onChange={(e) => setF({ ...f, [k]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <Field label="Parcours et présentation">
            <textarea
              value={f.pedigree}
              onChange={(e) => setF({ ...f, pedigree: e.target.value })}
            />
          </Field>
          <div className="actions">
            <button>Enregistrer le profil</button>
            <button
              type="button"
              className="ghost"
              onClick={() => setF(blank())}
            >
              Nouveau profil
            </button>
          </div>
        </form>
        {s.officials.some((o) => o.id === f.id) && (
          <PhotoUpload
            owner={s.officials.find((o) => o.id === f.id)!}
            ownerType="official"
            refresh={refresh}
          />
        )}
      </Panel>
      <Panel title="Personnalités et officiels">
        <div className="official-grid">
          {s.officials.map((o) => (
            <button
              className="official-card ghost"
              key={o.id}
              onClick={() => setF(o)}
            >
              {o.photo_id ? (
                <img src={"/api/v1/photos/" + o.photo_id} alt="" />
              ) : (
                <div className="photo-empty">FIBDA</div>
              )}
              <strong>{personName(o)}</strong>
              <span>{o.post}</span>
              <small>
                {o.organization} ·{" "}
                {o.photo_approved ? "Photo approuvée" : "Photo à contrôler"}
              </small>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
function Jury({ s, command }: Props) {
  const [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [roles, setRoles] = useState<string[]>(["judge"]);
  const [panel, setPanel] = useState<string[]>(s.jury?.panel || []),
    [trainees, setTrainees] = useState<string[]>(s.jury?.trainees || []),
    [withdrawal, setWithdrawal] = useState<string>(
      (s.jury?.withdrawal_order || []).join(","),
    );
  return (
    <>
      <div className="split">
        <Panel title="Inviter un membre">
          {canCommand(s.me.roles, "user.invite") ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await command("user.invite", { name, code, roles });
                  setCode("");
                  setName("");
                } catch {}
              }}
            >
              <Field label="Nom">
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Code personnel">
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  minLength={4}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Field>
              <Multi
                title="Rôles"
                items={Object.keys(labels)
                  .filter((k) =>
                    [
                      "chief",
                      "responsable",
                      "director",
                      "judge",
                      "trainee",
                      "secretariat",
                      "regie",
                      "speaker",
                      "commission",
                    ].includes(k),
                  )
                  .filter(
                    (id) =>
                      s.me.roles.includes("chief") ||
                      !["chief", "responsable", "director"].includes(id),
                  )
                  .map((id) => ({ id, name: labels[id] }))}
                value={roles}
                onChange={setRoles}
              />
              <button>Créer l’accès</button>
            </form>
          ) : (
            <Notice>Consultation uniquement pour votre rôle.</Notice>
          )}
        </Panel>
        <Panel title="Accès et approbations">
          <DataTable
            columns={["Membre", "Rôles", "État"]}
            rows={s.users.map((u) => [
              u.name,
              u.roles.map((r: string) => labels[r]).join(", "),
              u.approved ? (
                <Status value="Approuvé" />
              ) : (
                <AsyncButton
                  allowed={canCommand(s.me.roles, "user.approve")}
                  action={() => command("user.approve", { user_id: u.id })}
                >
                  Approuver
                </AsyncButton>
              ),
            ])}
          />
        </Panel>
      </div>
      <Panel title="Composition du jury">
        <Notice>
          5, 7, 9 ou 11 juges officiels, chef inclus. Un directeur ne vote pas,
          même s’il possède un autre rôle.
        </Notice>
        <Multi
          title="Juges officiels"
          items={s.users.filter(
            (u) =>
              u.approved &&
              !u.roles.includes("director") &&
              !u.roles.includes("trainee") &&
              (u.roles.includes("judge") ||
                u.roles.includes("chief") ||
                u.roles.includes("responsable")),
          )}
          value={panel}
          onChange={setPanel}
        />
        <Multi
          title="Stagiaires, hors calcul des résultats"
          items={s.users.filter(
            (u) => u.approved && u.roles.includes("trainee"),
          )}
          value={trainees}
          onChange={setTrainees}
        />
        <Field
          label="Ordre de retrait des juges"
          hint="Sélectionnez l’ordre ci-dessous. Le serveur contrôle la composition et les retraits."
        >
          <select
            value=""
            onChange={(e) =>
              setWithdrawal((v) =>
                v ? `${v},${e.target.value}` : e.target.value,
              )
            }
          >
            <option value="">Ajouter un juge à l’ordre de retrait…</option>
            {panel
              .filter((id) => !withdrawal.split(",").includes(id))
              .map((id) => (
                <option key={id} value={id}>
                  {s.users.find((u) => u.id === id)?.name}
                </option>
              ))}
          </select>
        </Field>
        <p>
          {withdrawal
            .split(",")
            .filter(Boolean)
            .map((id) => s.users.find((u) => u.id === id)?.name)
            .join(" → ") || "Aucun ordre défini"}
        </p>
        <div className="actions">
          <button className="ghost" onClick={() => setWithdrawal("")}>
            Recommencer l’ordre
          </button>
          <AsyncButton
            allowed={canCommand(s.me.roles, "jury.configure")}
            action={() =>
              command("jury.configure", {
                panel,
                trainees,
                withdrawal_order: withdrawal.split(",").filter(Boolean),
              })
            }
          >
            Enregistrer le jury
          </AsyncButton>
        </div>
      </Panel>
    </>
  );
}
export // Réduction de la photo dans le navigateur avant envoi : le serveur (serverless, sans bibliothèque
// d'image) n'accepte que 1 Mo au maximum et ne re-encode pas. Côté le plus long ramené à 1200 px,
// JPEG qualité 0,85 ; le recadrage éventuel (en pixels de l'original) est appliqué ici.
const PHOTO_MAX_SIDE = 1200;
const PHOTO_MAX_BYTES = 1024 * 1024;
async function reducePhoto(
  file: File,
  crop: number[] | null,
): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    // L'orientation EXIF (photo prise en portrait) est appliquée par le navigateur :
    // createImageBitmap avec « from-image » quand il existe, sinon l'élément Image, que les
    // navigateurs récents orientent aussi par défaut.
    const image: { naturalWidth: number; naturalHeight: number; source: CanvasImageSource } = await (async () => {
      if (typeof createImageBitmap === "function") {
        try {
          const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
          return { naturalWidth: bitmap.width, naturalHeight: bitmap.height, source: bitmap };
        } catch {
          // Format non pris en charge par createImageBitmap : repli sur Image.
        }
      }
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () =>
          reject(new Error(`Image illisible par le navigateur : type « ${file.type || "inconnu"} », ${Math.round(file.size / 1024)} Ko. Choisissez une photo JPEG, PNG ou WEBP (sur Android, une photo HEIC doit être convertie ; sur iPhone, réglez l’appareil sur « Le plus compatible »).`));
        el.src = url;
      });
      return { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, source: img };
    })();
    const [left, top, right, bottom] = crop ?? [
      0,
      0,
      image.naturalWidth,
      image.naturalHeight,
    ];
    const sourceWidth = right - left,
      sourceHeight = bottom - top;
    if (sourceWidth <= 0 || sourceHeight <= 0)
      throw new Error("Recadrage hors photo.");
    const scale = Math.min(
      1,
      PHOTO_MAX_SIDE / Math.max(sourceWidth, sourceHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Réduction d’image impossible sur ce navigateur.");
    context.drawImage(
      image.source,
      left,
      top,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    for (const quality of [0.85, 0.7, 0.5]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (!blob) throw new Error("Réduction d’image impossible sur ce navigateur.");
      if (blob.size <= PHOTO_MAX_BYTES) return blob;
    }
    throw new Error(
      "La photo reste trop lourde après réduction (plus de 1 Mo) : choisissez une image plus petite.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PhotoUpload({
  owner,
  ownerType,
  refresh,
}: {
  owner: Entity;
  ownerType: string;
  refresh: () => Promise<void>;
}) {
  const [kind, setKind] = useState("portrait"),
    [file, setFile] = useState<File>(),
    [error, setError] = useState(""),
    [uploaded, setUploaded] = useState(""),
    [consent, setConsent] = useState(false);
  const [preview, setPreview] = useState("");
  const [cropEnabled, setCropEnabled] = useState(false);
  const [bounds, setBounds] = useState([0, 0, 100, 100]);
  const [dimensions, setDimensions] = useState([0, 0]);
  useEffect(() => {
    setUploaded("");
    setConsent(false);
    setFile(undefined);
  }, [owner.id]);
  useEffect(() => {
    setBounds([0, 0, 100, 100]);
    setCropEnabled(false);
    setDimensions([0, 0]);
    setConsent(false);
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const photo =
    uploaded ||
    (ownerType === "official"
      ? owner.photo_id
      : owner[kind === "portrait" ? "photo_portrait" : "photo_full"]);
  return (
    <section className="photo-upload">
      <h3>Photographie et droit de diffusion</h3>
      <div className="form-grid">
        <Field label="Type">
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setUploaded("");
              setConsent(false);
            }}
          >
            <option value="portrait">Portrait</option>
            {ownerType === "person" && <option value="full">Plein pied</option>}
          </select>
        </Field>
        <Field label="Fichier image">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0])}
          />
        </Field>
      </div>
      {preview && (
        <>
          <div className="crop-preview">
            <img
              src={preview}
              alt="Photo originale sélectionnée"
              onLoad={(e) =>
                setDimensions([
                  e.currentTarget.naturalWidth,
                  e.currentTarget.naturalHeight,
                ])
              }
            />
            {cropEnabled && (
              <div
                className="crop-frame"
                style={{
                  left: bounds[0] + "%",
                  top: bounds[1] + "%",
                  width: bounds[2] - bounds[0] + "%",
                  height: bounds[3] - bounds[1] + "%",
                }}
              />
            )}
          </div>
          <Check
            label="Recadrer avant l’import"
            value={cropEnabled}
            onChange={setCropEnabled}
          />
          {cropEnabled && (
            <div className="form-grid">
              {[
                "Bord gauche (%)",
                "Bord haut (%)",
                "Bord droit (%)",
                "Bord bas (%)",
              ].map((label, index) => (
                <Field key={index} label={label}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={bounds[index]}
                    onChange={(e) =>
                      setBounds(
                        bounds.map((b, n) =>
                          n === index ? Number(e.target.value) : b,
                        ),
                      )
                    }
                  />
                </Field>
              ))}
            </div>
          )}
          <small>
            Image originale : {dimensions[0]} × {dimensions[1]} pixels. Le cadre
            vert délimite la zone conservée.
          </small>
        </>
      )}
      <small>
        La photo est réduite dans le navigateur avant l’envoi (1200 px de côté
        au plus, 1 Mo maximum).
      </small>
      {file && !uploaded && (
        <Notice kind="warning">
          Photo sélectionnée mais pas encore enregistrée : touchez « Importer la photo » ci-dessous.
        </Notice>
      )}
      <AsyncButton
        disabled={
          !file ||
          (cropEnabled &&
            (dimensions.some((x) => x <= 0) ||
              bounds[0] >= bounds[2] ||
              bounds[1] >= bounds[3] ||
              bounds.some((x) => x < 0 || x > 100)))
        }
        action={async () => {
          try {
            // Recadrage et réduction faits ici : le serveur reçoit un JPEG déjà prêt (1 Mo maxi).
            const crop = cropEnabled
              ? bounds.map((value, index) =>
                  Math.round((value / 100) * dimensions[index % 2]),
                )
              : null;
            const reduced = await reducePhoto(file!, crop);
            const fd = new FormData();
            fd.append("file", reduced, "photo.jpg");
            fd.append("owner_type", ownerType);
            fd.append("owner_id", owner.id);
            fd.append("kind", kind);
            const r = await api("/photos", { method: "POST", body: fd });
            setUploaded(r.id || r.photo_id);
            await refresh();
            setError("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Importer la photo
      </AsyncButton>
      {photo && (
        <>
          <img
            className="photo-preview"
            src={"/api/v1/photos/" + photo}
            alt="Photo à contrôler"
          />
          <Check
            label="Consentement de diffusion recueilli et photo vérifiée"
            value={consent}
            onChange={setConsent}
          />
          <AsyncButton
            disabled={!consent}
            action={async () => {
              try {
                await post("/photos/" + photo + "/approve", { consent: true });
                await refresh();
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Autoriser la diffusion publique
          </AsyncButton>
        </>
      )}
      {error && <Notice kind="error">{error}</Notice>}
    </section>
  );
}
function ImportPanel({ refresh }: { refresh: () => Promise<void> }) {
  const [file, setFile] = useState<File>(),
    [preview, setPreview] = useState<any>(),
    [error, setError] = useState("");
  return (
    <Panel title="Importer des inscriptions">
      <Field label="Fichier CSV ou XLSX">
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => {
            setFile(e.target.files?.[0]);
            setPreview(undefined);
          }}
        />
      </Field>
      <div className="actions">
        <AsyncButton
          disabled={!file}
          action={async () => {
            try {
              const fd = new FormData();
              fd.append("file", file!);
              setPreview(
                await api("/imports/preview", { method: "POST", body: fd }),
              );
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Contrôler avant import
        </AsyncButton>
        {preview && (
          <AsyncButton
            action={async () => {
              try {
                await post("/imports/commit", {
                  preview_id: preview.preview_id || preview.id,
                });
                await refresh();
                setPreview(undefined);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Confirmer cet import
          </AsyncButton>
        )}
      </div>
      {preview && (
        <JsonDetails
          label="Prévisualisation, erreurs et lignes détectées"
          data={preview}
        />
      )}{" "}
      {error && <Notice kind="error">{error}</Notice>}
    </Panel>
  );
}
export function Documents({ s, refresh }: Props) {
  const [cat, setCat] = useState(""),
    [round, setRound] = useState(""),
    [judge, setJudge] = useState(""),
    [error, setError] = useState(""),
    [backup, setBackup] = useState<File>(),
    [confirm, setConfirm] = useState(false);
  const personalOnly = !s.me.roles.some((role: string) =>
    ["chief", "responsable", "director", "secretariat", "commission"].includes(
      role,
    ),
  );
  const query = new URLSearchParams({
    category_id: cat,
    round_id: round,
    judge_id: personalOnly ? s.me.id : judge,
  });
  const kinds: Record<string, string> = {
    blank: "Bulletins vierges",
    ballot: "Bulletin individuel",
    recap: "Récapitulatif jury",
    registrations: "Inscriptions",
    fiche: "Fiches d’inscription",
    programme: "Ordre de passage",
    measures: "Mesures",
    results: "Résultats",
    rewards: "Récompenses",
    diploma: "Diplôme",
    exams: "Examen des stagiaires",
    officials: "Officiels",
  };
  return (
    <>
      <Panel title="Impressions et exports">
        <div className="form-grid">
          <Field label="Catégorie">
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Toutes les catégories</option>
              {s.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Manche">
            <select value={round} onChange={(e) => setRound(e.target.value)}>
              <option value="">Toutes les manches</option>
              {s.rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {s.categories.find((c) => c.id === r.category_id)?.name} ·{" "}
                  {labels[r.phase]}
                </option>
              ))}
            </select>
          </Field>
          {!personalOnly && (
            <Field label="Juge">
              <select value={judge} onChange={(e) => setJudge(e.target.value)}>
                <option value="">Tous les juges</option>
                {s.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <div className="document-grid">
          {Object.entries(kinds)
            .filter(
              ([kind]) =>
                !personalOnly || ["blank", "ballot", "exams"].includes(kind),
            )
            .map(([k, label]) => (
              <a
                className="document-link"
                key={k}
                href={`/api/v1/print/${k}?${query}`}
                target="_blank"
                rel="noreferrer"
              >
                <span>↗</span>
                {label}
                <small>Ouvrir la version imprimable</small>
              </a>
            ))}
        </div>
        <div className="actions">
          {/* Exports produits par le serveur (printing.ts) ; l'impression passe aussi par le HTML. */}
          {!personalOnly &&
            ["csv", "xlsx", "pdf"].map((format) => (
              <a
                className="button ghost"
                key={format}
                href={`/api/v1/export/results?format=${format}&${query}`}
              >
                Résultats {format.toUpperCase()}
              </a>
            ))}
        </div>
      </Panel>
      {(s.me.roles.includes("chief") || s.me.roles.includes("director")) && (
        <Panel title="Sauvegarde et restauration">
          <Notice>
            Une restauration remplace l’événement actif, conserve une copie
            serveur de l’état précédent et déconnecte tous les appareils. Les
            anciens brouillons ne seront pas réutilisés.
          </Notice>
          <AsyncButton
            action={async () => {
              try {
                await download("/backup", "fibda-sauvegarde.json", "POST");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Télécharger une sauvegarde complète
          </AsyncButton>
          <Field label="Sauvegarde (fichier fibda-sauvegarde.json) à restaurer">
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                setBackup(e.target.files?.[0]);
                setConfirm(false);
              }}
            />
          </Field>
          <Check
            label="Je confirme le remplacement de l’événement et la déconnexion des appareils"
            value={confirm}
            onChange={setConfirm}
          />
          <AsyncButton
            disabled={!backup || !confirm}
            action={async () => {
              try {
                const fd = new FormData();
                fd.append("file", backup!);
                await api("/restore", { method: "POST", body: fd });
                await refresh();
                location.reload();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Restaurer cette sauvegarde
          </AsyncButton>
          {error && <Notice kind="error">{error}</Notice>}
        </Panel>
      )}
    </>
  );
}
function BatchPhotos(_props: { s: State; refresh: () => Promise<void> }) {
  // L'import par archive ZIP (POST /photos/batch) répond 501 sur cette version serverless :
  // chaque photo s'ajoute depuis la fiche individuelle, avec son consentement.
  return (
    <Panel title="Importer un lot de photographies">
      <Notice kind="info">
        L’import par archive ZIP n’est pas disponible sur cette version :
        ajoutez les photos une par une depuis la fiche de chaque personne ou
        officiel, puis contrôlez le consentement de diffusion sur la fiche.
      </Notice>
    </Panel>
  );
}
