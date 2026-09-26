import { drapeau, paysAvecDrapeau } from "./pays";
import { canCommand } from "./permissions";
import { reconnaitrePhoto, type Reconnaissance } from "./photosLot";
import {
  categorieActive,
  categoriesAInscrire,
  categoriesInscriptibles,
  choisirCategorie,
  confirmationPossible,
  ficheComplete,
  fusionCompatible,
  inscriptionTardiveRequise,
  nomFusionParDefaut,
  type Choix,
  type Proposition,
} from "./categorieAuto";
import { Fragment, useEffect, useState, type FormEvent } from "react";
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
  ActionMenu,
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
// Rubrique désignée par l'adresse : #preparation/athletes ouvre « Athlètes » (liens du Parcours).
const RUBRIQUE_PAR_SLUG: Record<string, string> = {
  evenement: "Événement", athletes: "Athlètes", mesures: "Mesures", categories: "Catégories",
  programme: "Programme", officiels: "Officiels", jury: "Jury", documents: "Documents",
};
function rubriqueDepuisAdresse(): string | null {
  const slug = location.hash.split("/")[1];
  return slug ? (RUBRIQUE_PAR_SLUG[slug] ?? null) : null;
}
export function Preparation(p: Props) {
  const [tab, setTab] = useState(() => rubriqueDepuisAdresse() ?? "Événement");
  useEffect(() => {
    const suivre = () => {
      const r = rubriqueDepuisAdresse();
      if (r) setTab(r);
    };
    window.addEventListener("hashchange", suivre);
    return () => window.removeEventListener("hashchange", suivre);
  }, []);
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
            <AsyncButton
              allowed={canCommand(s.me.roles, "event.reset")}
              className="ghost"
              disabled={s.status === "preparation"}
              action={async () => {
                const saisie = window.prompt(
                  "Revenir en préparation efface les manches, bulletins, résultats et récompenses. Comptes, athlètes, catégories, dossards et jury sont conservés. Tapez REINITIALISER pour confirmer.",
                );
                if (saisie === null) return;
                await command("event.reset", { confirm: saisie.trim().toUpperCase() });
              }}
            >
              Revenir en préparation
            </AsyncButton>
            <AsyncButton
              allowed={canCommand(s.me.roles, "event.purge")}
              className="ghost danger"
              action={async () => {
                const saisie = window.prompt(
                  `Vider la compétition efface définitivement ${s.people.length} athlètes, ${s.categories.length} catégories, les officiels, le jury, les manches, les résultats et les photos. Les comptes et l’identité de l’événement sont conservés. Faites une sauvegarde avant. Tapez VIDER pour confirmer.`,
                );
                if (saisie === null) return;
                // Saisie exacte exigée (vidage irréversible) : pas de mise en majuscules côté écran.
                await command("event.purge", { confirm: saisie.trim() });
              }}
            >
              Vider la compétition
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
// Multi-inscription (PO, 26/09/2026) : plusieurs catégories actives peuvent être cochées, une
// commande entry.save (ou entry.late) part par catégorie cochée non encore inscrite.
// Les règles d'admission restent celles du serveur (preparation.ts) : les messages serveur
// sont affichés tels quels.
type MessageFiche = { kind: "success" | "warning" | "error"; text: string };
const CONTROLES_CONFIRMATION =
  "« Statut approuvé », « Licence contrôlée », « Paiement reçu » et « Mesures confirmées »";
function People({ s, command, refresh }: Props) {
  const [person, setPerson] = useState<Entity>(personDefault);
  /** Catégories cochées dans « Catégories d'inscription » (celles déjà inscrites y figurent, verrouillées). */
  const [choisies, setChoisies] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [choix, setChoix] = useState<Choix>();
  const [derogation, setDerogation] = useState("");
  const [reason, setReason] = useState("Inscription tardive");
  const [message, setMessage] = useState<MessageFiche>();
  const [selection, setSelection] = useState<string[]>([]);
  const update = (k: string, v: any) => setPerson({ ...person, [k]: v });
  const peutSupprimer = canCommand(s.me.roles, "person.delete");
  const cocher = (id: string, on: boolean) =>
    setSelection((cur) =>
      on ? [...new Set([...cur, id])] : cur.filter((x) => x !== id),
    );
  /** Supprime des fiches après confirmation nominative ; la fiche ouverte est refermée si elle en fait partie. */
  async function supprimer(ids: string[]) {
    const noms = ids
      .map((id) => personName(s.people.find((p) => p.id === id)))
      .join(", ");
    if (
      !window.confirm(
        `Supprimer définitivement ${ids.length} athlète${ids.length > 1 ? "s" : ""} (${noms}), avec inscriptions, dossards et photos ? Refusé si une de leurs catégories a commencé.`,
      )
    )
      return;
    await command("person.delete", { person_ids: ids });
    setSelection((cur) => cur.filter((x) => !ids.includes(x)));
    if (ids.includes(person.id)) ouvrir(personDefault());
  }
  const existing = s.people.some((p) => p.id === person.id);
  const chief = s.me.roles.includes("chief");
  const tardif = inscriptionTardiveRequise(s);
  const peutInscrireTardif = canCommand(s.me.roles, "entry.late");
  const peutCreerCategorie = canCommand(s.me.roles, "category.save");
  const inscriptions = s.entries.filter((e) => e.person_id === person.id);
  const nomCategorie = (id: string) =>
    s.categories.find((c) => c.id === id)?.name ?? "la catégorie choisie";
  // Seules les catégories actives de la section de la fiche reçoivent un athlète (règles serveur :
  // « Catégorie désactivée. », « Le cumul amateur/pro est interdit. »).
  const categoriesProposees = categoriesInscriptibles(s.categories).filter(
    (c) => c.section === person.section,
  );
  const cocherCategorie = (id: string, on: boolean) =>
    setChoisies((cur) => (on ? [...new Set([...cur, id])] : cur.filter((x) => x !== id)));

  function ouvrir(p: Entity) {
    setPerson({ ...personDefault(), ...p });
    setChoix(undefined);
    setChoisies(s.entries.filter((e) => e.person_id === p.id).map((e) => e.category_id));
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
   * Crée l'inscription de la fiche enregistrée dans la catégorie cible et renvoie le compte rendu.
   * Avant les dossards : `entry.save`, confirmée si les contrôles sont cochés, sinon brouillon.
   * Après les dossards ou compétition démarrée : `entry.late` (chef et responsable).
   * Un refus serveur non rattrapable remonte en exception (message serveur tel quel).
   */
  async function inscrire(saved: Entity, cible: string): Promise<MessageFiche> {
    const nom = nomCategorie(cible);
    if (s.entries.some((e) => e.person_id === saved.id && e.category_id === cible)) {
      return { kind: "success", text: "Inscription déjà présente dans " + nom + "." };
    }
    const derog = chief && derogation.trim() ? { reason: derogation.trim() } : undefined;
    if (tardif) {
      if (!peutInscrireTardif) {
        return {
          kind: "warning",
          text: "Les dossards sont attribués : l'inscription tardive dans " + nom + " est réservée au chef et au responsable.",
        };
      }
      const r = await command("entry.late", { person: saved, category_id: cible, reason, derogation: derog });
      return {
        kind: "success",
        text: "Inscription tardive enregistrée dans " + nom + (r.result?.bib ? ", dossard n° " + r.result.bib : "") + ".",
      };
    }
    const confirmee = confirmationPossible(saved, s.mode);
    const base = { id: uid(), person_id: saved.id, category_id: cible, confirmed: confirmee, bib: null, derogation: derog ?? null };
    const brouillon = "Inscription en brouillon dans " + nom + " : cochez " + CONTROLES_CONFIRMATION + " puis touchez « Confirmer l'inscription ».";
    try {
      await command("entry.save", { entry: base });
      return confirmee
        ? { kind: "success", text: "Inscription confirmée dans " + nom + "." }
        : { kind: "warning", text: brouillon };
    } catch (e) {
      if (!confirmee) throw e;
      // Le serveur refuse la confirmation (motif affiché) : l'inscription reste en brouillon.
      await command("entry.save", { entry: { ...base, confirmed: false, derogation: null } });
      return { kind: "warning", text: brouillon + " Refus de confirmation par le serveur : " + (e as Error).message };
    }
  }

  /** Inscrit dans chaque catégorie cible, une commande par catégorie, et récapitule créations et refus. */
  async function inscrireToutes(saved: Entity, cibles: string[], prefixe = ""): Promise<void> {
    const resultats: MessageFiche[] = [];
    for (const cible of cibles) {
      try {
        resultats.push(await inscrire(saved, cible));
      } catch (e) {
        resultats.push({ kind: "error", text: "Refus pour " + nomCategorie(cible) + " : " + (e as Error).message });
      }
    }
    const kind = resultats.some((r) => r.kind === "error")
      ? "error"
      : resultats.some((r) => r.kind === "warning")
        ? "warning"
        : "success";
    setMessage({ kind, text: prefixe + resultats.map((r) => r.text).join(" ") });
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
    const actuelles = s.entries.filter((e) => e.person_id === saved.id);
    const admissibles = new Set(
      categoriesInscriptibles(s.categories).filter((c) => c.section === saved.section).map((c) => c.id),
    );
    let cibles = categoriesAInscrire(choisies, actuelles).filter((id) => admissibles.has(id));
    // Rien de coché et aucune inscription : catégorie proposée automatiquement par le référentiel.
    if (cibles.length === 0 && actuelles.length === 0 && ficheComplete(saved)) {
      const proposition = choisirCategorie(await propositionsServeur(saved.id), s.categories, saved.section);
      setChoix(proposition);
      let cible = "";
      if (proposition.category_id) cible = proposition.category_id;
      else if (proposition.rule_id) {
        if (peutCreerCategorie) cible = await creerCategorie(proposition.rule_id);
        else {
          setMessage({
            kind: "warning",
            text: "Fiche enregistrée. " + proposition.message + " Aucune catégorie n'a été créée : " + (s.bibs_distributed ? "les catégories sont figées après attribution des dossards" : "la création est réservée au chef et au responsable") + ". Cochez une catégorie existante dans « Catégories d'inscription » puis touchez « Enregistrer ».",
          });
          return;
        }
      } else {
        setMessage({ kind: "warning", text: "Fiche enregistrée. " + proposition.message });
        return;
      }
      cocherCategorie(cible, true);
      cibles = [cible];
    }
    if (cibles.length === 0) {
      setMessage(
        actuelles.length > 0
          ? { kind: "success", text: "Fiche enregistrée. Inscriptions inchangées : cochez une catégorie supplémentaire dans « Catégories d'inscription » pour en ajouter une." }
          : {
              kind: "warning",
              text: "Fiche enregistrée sans inscription : renseignez sexe, date de naissance, taille et poids pour une catégorie automatique, ou cochez une ou plusieurs catégories dans « Catégories d'inscription » puis touchez « Enregistrer ».",
            },
      );
      return;
    }
    await inscrireToutes(saved, cibles, "Fiche enregistrée. ");
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
                ["private_contact", "Téléphone (WhatsApp de préférence)"],
                ["pronunciation", "Prononciation speaker"],
              ].map(([k, label]) => (
                <Fragment key={k}>
                  <Field label={label}>
                    <input
                      required={[
                        "first_name",
                        "last_name",
                        "birth_date",
                      ].includes(k)}
                      type={k === "birth_date" ? "date" : k === "private_contact" ? "tel" : "text"}
                      autoComplete={k === "private_contact" ? "tel" : undefined}
                      value={person[k] || ""}
                      onChange={(e) => update(k, e.target.value)}
                    />
                  </Field>
                  {k === "club" && (
                    <ClubLogo club={person.club || ""} s={s} refresh={refresh} />
                  )}
                </Fragment>
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
            <fieldset className="categories-inscription">
              <legend>Catégories d'inscription</legend>
              <p className="muted">
                Cochez une ou plusieurs catégories actives ({labels[person.section]}) : une
                inscription est créée dans chacune à « Enregistrer ». Rien de coché sur une fiche
                sans inscription : le référentiel propose la catégorie d'après sexe, âge, taille et
                poids, et la crée si elle n'existe pas. Une catégorie désactivée n'est pas proposée.
              </p>
              {categoriesProposees.length === 0 && (
                <p className="muted">Aucune catégorie active en section {labels[person.section]} pour le moment.</p>
              )}
              <div className="checks">
                {categoriesProposees.map((c) => {
                  const inscrite = inscriptions.some((e) => e.category_id === c.id);
                  return (
                    <label className="check" key={c.id}>
                      <input
                        type="checkbox"
                        checked={inscrite || choisies.includes(c.id)}
                        disabled={inscrite}
                        onChange={(e) => cocherCategorie(c.id, e.target.checked)}
                      />
                      {c.name}
                      {inscrite ? " · déjà inscrit" : ""}
                    </label>
                  );
                })}
              </div>
            </fieldset>
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
              {existing && peutSupprimer && (
                <AsyncButton
                  className="ghost danger"
                  action={() => supprimer([person.id])}
                >
                  Supprimer cette fiche
                </AsyncButton>
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
                    {a.desactivee ? "Catégorie désactivée (à réactiver dans Catégories)" : a.category_id ? "Catégorie existante" : "Catégorie à créer"}
                    {a.motifs.length > 0 ? " · " + a.motifs.join(" ") : ""}
                  </small>
                  {existing && a.category_id && !a.desactivee && (
                    <AsyncButton
                      className="ghost"
                      allowed={canCommand(s.me.roles, tardif ? "entry.late" : "entry.save")}
                      action={async () => {
                        cocherCategorie(a.category_id!, true);
                        await inscrireToutes(person, [a.category_id!]);
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
                          cocherCategorie(id, true);
                          await inscrireToutes(person, [id]);
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
            </section>
          )}
          {existing && (
            <>
              <h3>Inscriptions de cette personne</h3>
              <p className="muted">
                Confirmez après les contrôles et les mesures. Déconfirmez avant
                une correction incompatible. Pour ajouter une catégorie : cochez-la
                dans « Catégories d'inscription » puis « Enregistrer ». « Retirer de
                cette catégorie » supprime l'inscription seule : la fiche de l'athlète
                reste (« Supprimer cette fiche » efface l'athlète de l'application).
              </p>
              {inscriptions.map((entry) => {
                const cat = s.categories.find((c) => c.id === entry.category_id);
                const inactive = cat !== undefined && !categorieActive(cat);
                return (
                <div className={"entry-row" + (inactive ? " categorie-inactive" : "")} key={entry.id}>
                  <strong>{nomCategorie(entry.category_id)}</strong>
                  <small>
                    {entry.bib ? "N° " + entry.bib : "Sans dossard"} ·{" "}
                    {entry.confirmed
                      ? "Inscription confirmée"
                      : "À contrôler"}
                    {entry.late_reason ? " · tardive : " + entry.late_reason : ""}
                    {inactive ? " · catégorie désactivée, non jouée" : ""}
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
                  <AsyncButton
                    allowed={canCommand(s.me.roles, "entry.remove")}
                    className="ghost danger"
                    action={async () => {
                      if (
                        !window.confirm(
                          `Retirer ${personName(person)} de la catégorie ${nomCategorie(entry.category_id)} ? L'inscription${entry.bib ? " et son dossard n° " + entry.bib : ""} sont supprimés ; la fiche de l'athlète reste. Refusé si la catégorie a commencé.`,
                        )
                      )
                        return;
                      await command("entry.remove", { entry_id: entry.id });
                      setChoisies((cur) => cur.filter((id) => id !== entry.category_id));
                      setMessage({ kind: "success", text: "Inscription retirée de " + nomCategorie(entry.category_id) + ". La fiche reste enregistrée." });
                    }}
                  >
                    Retirer de cette catégorie
                  </AsyncButton>
                </div>
                );
              })}
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
          {peutSupprimer && (
            <div className="actions selection-bar">
              <label>
                <input
                  type="checkbox"
                  aria-label="Tout sélectionner"
                  checked={
                    selection.length > 0 && selection.length === s.people.length
                  }
                  onChange={(e) =>
                    setSelection(
                      e.target.checked ? s.people.map((p) => p.id) : [],
                    )
                  }
                />{" "}
                {selection.length} sélectionné{selection.length > 1 ? "s" : ""}
              </label>
              <AsyncButton
                className="ghost danger"
                disabled={selection.length === 0}
                action={() => supprimer(selection)}
              >
                Supprimer la sélection
              </AsyncButton>
            </div>
          )}
          <div className="person-list">
            {s.people
              .filter((p) =>
                (personName(p) + " " + p.club)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((p) => (
                <div className="person-line" key={p.id}>
                  {peutSupprimer && (
                    <input
                      type="checkbox"
                      aria-label={"Sélectionner " + personName(p)}
                      checked={selection.includes(p.id)}
                      onChange={(e) => cocher(p.id, e.target.checked)}
                    />
                  )}
                  <button
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
                </div>
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
const CUSTOM = "__custom__";
type CustomForm = { discipline: string; division: string; metric: string; lower_exclusive: string; upper_inclusive: string; age_min: string; age_max: string };
const customDefault = (cat: Entity): CustomForm => ({
  discipline: cat.discipline || "bodybuilding", division: cat.division || "senior", metric: "", lower_exclusive: "", upper_inclusive: "", age_min: "", age_max: "",
});
const customDepuisRegle = (rule: Entity): CustomForm => ({
  discipline: rule.discipline, division: rule.division, metric: rule.lower_exclusive || rule.upper_inclusive ? rule.metric : "",
  lower_exclusive: rule.lower_exclusive ?? "", upper_inclusive: rule.upper_inclusive ?? "", age_min: rule.age_min ?? "", age_max: rule.age_max ?? "",
});
/** Champs vides → absents ; âges en entiers ; le nom de la règle est le nom affiché de la catégorie. */
function customPayload(c: CustomForm, name?: string): Record<string, any> {
  const out: Record<string, any> = { discipline: c.discipline, division: c.division, name: name ?? "" };
  if (c.metric) out.metric = c.metric;
  for (const k of ["lower_exclusive", "upper_inclusive"] as const) if (String(c[k]).trim()) out[k] = String(c[k]).trim();
  for (const k of ["age_min", "age_max"] as const) if (String(c[k]).trim()) out[k] = Number(c[k]);
  return out;
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
    active: true,
  });
  const [merge, setMerge] = useState<string[]>([]);
  const personnalisee = cat.rule_id === CUSTOM || (typeof cat.rule_id === "string" && cat.rule_id.startsWith("custom-"));
  const majCustom = (patch: Record<string, any>) => setCat({ ...cat, custom: { ...cat.custom, ...patch } });
  /** Charge une catégorie dans le formulaire ; une règle personnalisée retrouve ses champs depuis `rule`. */
  const editer = (c: Entity) => setCat(c.rule && c.rule.custom ? { ...c, custom: customDepuisRegle(c.rule) } : { ...c, custom: undefined });
  /** Une catégorie commencée (manche ouverte ou jouée) ne peut plus être activée ni désactivée (règle serveur). */
  const commencee = (id: string) =>
    s.rounds.some(
      (r) => r.category_id === id && (r.status !== "pending" || (r.opened_at !== null && r.opened_at !== undefined)),
    );
  const [mergeName, setMergeName] = useState("");
  return (
    <div className="split">
      <Panel title="Catégorie et référentiel">
        {canCommand(s.me.roles, "category.save") ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await command("category.save", { category: personnalisee ? { ...cat, rule_id: undefined, custom: customPayload(cat.custom, cat.name) } : cat }).catch(() => {});
            }}
          >
            <Field label="Règle du catalogue">
              <select
                required
                value={personnalisee ? CUSTOM : cat.rule_id}
                onChange={(e) => {
                  if (e.target.value === CUSTOM) {
                    setCat({ ...cat, rule_id: CUSTOM, custom: cat.custom ?? customDefault(cat) });
                    return;
                  }
                  const rule = catalogue.rules.find(
                    (r: any) => r.id === e.target.value,
                  );
                  if (rule)
                    setCat({
                      ...cat,
                      rule_id: rule.id,
                      custom: undefined,
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
                <option value={CUSTOM}>Règle personnalisée (hors référentiel)</option>
                {(catalogue.rules || []).map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.division} · {r.id}
                  </option>
                ))}
              </select>
            </Field>
            {personnalisee && (
              <div className="form-grid">
                {/* Règle personnalisée (PO, 26/09/2026) : les classes de l'ordre de passage FIBDA (Men's Physique
                    −176 / 176–182 / +182, Bodybuilding −80 / +80…) n'existent pas dans le référentiel IFBB. */}
                <Field label="Discipline">
                  <select
                    value={cat.custom.discipline}
                    onChange={(e) => majCustom({ discipline: e.target.value })}
                  >
                    {(catalogue.disciplines || []).map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.sex === "F" ? "dames" : "hommes"})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Division">
                  <select
                    value={cat.custom.division}
                    onChange={(e) => majCustom({ division: e.target.value })}
                  >
                    <option value="senior">Senior</option>
                    <option value="junior">Junior</option>
                    <option value="masters">Masters</option>
                  </select>
                </Field>
                <Field label="Mesure" hint="Aucune = classe ouverte, sans borne.">
                  <select
                    value={cat.custom.metric}
                    onChange={(e) =>
                      majCustom(
                        e.target.value
                          ? { metric: e.target.value }
                          : { metric: "", lower_exclusive: "", upper_inclusive: "" },
                      )
                    }
                  >
                    <option value="">Aucune (classe ouverte)</option>
                    <option value="height_cm">Taille (cm)</option>
                    <option value="weight_kg">Poids (kg)</option>
                  </select>
                </Field>
                <Field label="Au-dessus de (exclu)" hint="Vide = pas de minimum. Ex. 176 pour « plus de 176 cm »">
                  <input
                    inputMode="decimal"
                    disabled={!cat.custom.metric}
                    value={cat.custom.lower_exclusive}
                    onChange={(e) => majCustom({ lower_exclusive: e.target.value })}
                  />
                </Field>
                <Field label="Jusqu'à (inclus)" hint="Vide = pas de maximum. Ex. 182 pour « 182 cm ou moins »">
                  <input
                    inputMode="decimal"
                    disabled={!cat.custom.metric}
                    value={cat.custom.upper_inclusive}
                    onChange={(e) => majCustom({ upper_inclusive: e.target.value })}
                  />
                </Field>
                <Field label="Âge minimum (facultatif)">
                  <input inputMode="numeric" value={cat.custom.age_min} onChange={(e) => majCustom({ age_min: e.target.value })} />
                </Field>
                <Field label="Âge maximum (facultatif)">
                  <input inputMode="numeric" value={cat.custom.age_max} onChange={(e) => majCustom({ age_max: e.target.value })} />
                </Field>
              </div>
            )}
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
        <p className="muted">
          Créez autant de catégories que nécessaire. Seules les catégories actives reçoivent des
          athlètes et sont jouées ; une catégorie désactivée garde ses inscriptions mais n'a ni
          manche ni dossard. Activer ou désactiver reste possible tant que la catégorie n'a pas
          commencé.
        </p>
        <DataTable
          columns={["Catégorie", "Inscrits", "État", "Action"]}
          rows={s.categories
            .filter((c) => !c.archived)
            .map((c) => {
              const active = categorieActive(c);
              return [
                <span className={active ? undefined : "categorie-inactive"}>
                  <strong>{c.name}</strong>
                  <small>
                    {labels[c.section]} · {c.division}
                  </small>
                </span>,
                s.entries.filter((e) => e.category_id === c.id).length,
                <Status value={active ? "categorie_active" : "categorie_inactive"} />,
                <ActionMenu label={"Actions sur " + c.name}>
                  <button className="ghost" type="button" onClick={() => editer(c)}>
                    Modifier
                  </button>
                  <AsyncButton
                    allowed={canCommand(s.me.roles, "category.activate")}
                    className="ghost"
                    disabled={commencee(c.id)}
                    action={() => command("category.activate", { category_id: c.id, active: !active })}
                  >
                    {active ? "Désactiver" : "Activer"}
                  </AsyncButton>
                  <AsyncButton
                    allowed={canCommand(s.me.roles, "category.delete")}
                    className="ghost danger"
                    action={async () => {
                      const inscrits = s.entries.filter((e) => e.category_id === c.id).length;
                      if (
                        !window.confirm(
                          `Supprimer la catégorie ${c.name} et ses ${inscrits} inscription${inscrits > 1 ? "s" : ""} ? Les fiches des athlètes restent. Refusé si la catégorie a commencé.`,
                        )
                      )
                        return;
                      await command("category.delete", { category_id: c.id });
                      if (cat.id === c.id) setCat({ ...cat, id: uid(), name: "", entry_ids: [], merged_from: [] });
                    }}
                  >
                    Supprimer
                  </AsyncButton>
                </ActionMenu>,
              ];
            })}
        />
        {canCommand(s.me.roles, "category.fuse") && (
          <section className="fusion">
            <h3>Fusion de catégories (chef ou responsable, avant attribution des dossards)</h3>
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
                    {categoriesInscriptibles(s.categories)
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
            <span className={categorieActive(c) ? undefined : "categorie-inactive"}>
              <strong>{c.name}</strong>
              <small>
                {labels[c.section]}
                {categorieActive(c) ? "" : " · désactivée, non jouée"}
              </small>
            </span>,
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
            <div className="official-item" key={o.id}>
              <button
                className="official-card ghost"
                type="button"
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
              <ActionMenu label={"Actions sur " + personName(o)}>
              <button className="ghost" type="button" onClick={() => setF(o)}>
                Modifier
              </button>
              <AsyncButton
                allowed={canCommand(s.me.roles, "official.delete")}
                className="ghost danger"
                action={async () => {
                  if (
                    !window.confirm(
                      `Supprimer la fiche officiel de ${personName(o)} (${o.post || "sans fonction"}) et sa photo ? Son compte d'accès, s'il existe, n'est pas touché.`,
                    )
                  )
                    return;
                  await command("official.delete", { official_id: o.id });
                  if (f.id === o.id) setF(blank());
                }}
              >
                Supprimer
              </AsyncButton>
              </ActionMenu>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
// Fiche officiel à créer pour un compte (juge, chef, responsable, directeur, stagiaire) : la photo
// se prend ensuite sur la fiche officiel (rubrique Officiels), jamais sur le compte lui-même.
const ROLES_AVEC_FICHE = ["chief", "responsable", "director", "judge", "trainee"];
const normaliseNom = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
function ficheOfficielDuCompte(s: State, u: Entity): Entity | undefined {
  const cible = normaliseNom(u.name || "");
  return s.officials.find((o) => normaliseNom(personName(o)) === cible);
}
function officielDepuisCompte(u: Entity): { first_name: string; last_name: string; post: string } | null {
  const mots = (u.name || "").trim().split(/\s+/).filter(Boolean);
  if (mots.length < 2) return null;
  const role = ROLES_AVEC_FICHE.find((r) => u.roles.includes(r)) ?? u.roles[0];
  return { first_name: mots[0], last_name: mots.slice(1).join(" "), post: labels[role] ?? "Juge" };
}
function Jury({ s, command }: Props) {
  const [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [roles, setRoles] = useState<string[]>(["judge"]);
  // Compte en cours de modification (chef seul) : le formulaire d'invitation passe en mode édition.
  const [edition, setEdition] = useState<Entity>();
  const ouvrirEdition = (u: Entity) => {
    setEdition(u);
    setName(u.name);
    setRoles(u.roles);
    setCode("");
  };
  const fermerEdition = () => {
    setEdition(undefined);
    setName("");
    setRoles(["judge"]);
    setCode("");
  };
  const [panel, setPanel] = useState<string[]>(s.jury?.panel || []),
    [trainees, setTrainees] = useState<string[]>(s.jury?.trainees || []),
    [withdrawal, setWithdrawal] = useState<string>(
      (s.jury?.withdrawal_order || []).join(","),
    );
  return (
    <>
      <div className="split">
        <Panel title={edition ? `Modifier le compte de ${edition.name}` : "Inviter un membre"}>
          {canCommand(s.me.roles, "user.invite") ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  if (edition) {
                    await command("user.update", {
                      user_id: edition.id,
                      name,
                      roles,
                      ...(code ? { code } : {}),
                    });
                    fermerEdition();
                  } else {
                    await command("user.invite", { name, code, roles });
                    setCode("");
                    setName("");
                  }
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
              <Field label={edition ? "Nouveau code (laisser vide pour conserver)" : "Code personnel"}>
                <input
                  required={!edition}
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
                  .filter((id) => !edition || id !== "chief")
                  .map((id) => ({ id, name: labels[id] }))}
                value={roles}
                onChange={setRoles}
              />
              <div className="actions">
                <button>{edition ? "Enregistrer le compte" : "Créer l’accès"}</button>
                {edition && (
                  <button type="button" className="ghost" onClick={fermerEdition}>
                    Annuler
                  </button>
                )}
              </div>
              {edition && (
                <small>
                  Le rôle de chef ne se modifie pas ici. Un nouveau code ferme les sessions de ce
                  compte : son titulaire devra se reconnecter.
                </small>
              )}
            </form>
          ) : (
            <Notice>Consultation uniquement pour votre rôle.</Notice>
          )}
        </Panel>
        <Panel title="Accès et approbations">
          <DataTable
            columns={["Membre", "Rôles", "État", "Fiche officiel", "Action"]}
            rows={s.users.map((u) => [
              u.name,
              u.roles.map((r: string) => labels[r]).join(", "),
              u.active === false ? (
                <Status value="Désactivé" />
              ) : u.approved ? (
                <Status value="Approuvé" />
              ) : (
                <AsyncButton
                  allowed={canCommand(s.me.roles, "user.approve")}
                  action={() => command("user.approve", { user_id: u.id })}
                >
                  Approuver
                </AsyncButton>
              ),
              !u.roles.some((r: string) => ROLES_AVEC_FICHE.includes(r)) ? (
                ""
              ) : ficheOfficielDuCompte(s, u) ? (
                <small>Fiche existante : photo dans « Officiels »</small>
              ) : officielDepuisCompte(u) ? (
                <AsyncButton
                  allowed={canCommand(s.me.roles, "official.save")}
                  action={() =>
                    command("official.save", { official: { id: uid(), ...officielDepuisCompte(u)! } })
                  }
                >
                  Créer la fiche officiel de ce compte
                </AsyncButton>
              ) : (
                <small>Nom du compte en un seul mot : créez la fiche dans « Officiels ».</small>
              ),
              u.id === s.me.id ? (
                <small>Votre compte</small>
              ) : (
                <ActionMenu label={"Actions sur le compte de " + u.name}>
                  {canCommand(s.me.roles, "user.update") && !u.roles.includes("chief") && (
                    <button type="button" className="ghost" onClick={() => ouvrirEdition(u)}>
                      Modifier
                    </button>
                  )}
                  <AsyncButton
                    allowed={canCommand(s.me.roles, "user.deactivate")}
                    className="ghost"
                    disabled={u.active === false}
                    action={async () => {
                      if (
                        !window.confirm(
                          `Désactiver le compte de ${u.name} ? Ses sessions sont fermées et son code ne donne plus accès ; ses bulletins et sa place dans les rapports restent.`,
                        )
                      )
                        return;
                      await command("user.deactivate", { user_id: u.id });
                    }}
                  >
                    Désactiver
                  </AsyncButton>
                  <AsyncButton
                    allowed={canCommand(s.me.roles, "user.delete")}
                    className="ghost danger"
                    action={async () => {
                      if (
                        !window.confirm(
                          `Supprimer définitivement le compte de ${u.name} (${u.roles.map((r: string) => labels[r]).join(", ")}) ? Refusé s'il a siégé ou voté : désactivez-le alors.`,
                        )
                      )
                        return;
                      await command("user.delete", { user_id: u.id });
                    }}
                  >
                    Supprimer le compte
                  </AsyncButton>
                </ActionMenu>
              ),
            ])}
          />
          <small>
            La photo d'un juge se prend sur sa fiche officiel (rubrique « Officiels »), pas sur son compte.
          </small>
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
// Un logo de club est petit sur les écrans : 400 px de côté suffisent.
const LOGO_MAX_SIDE = 400;
const PHOTO_MAX_BYTES = 1024 * 1024;
async function reducePhoto(
  file: File,
  crop: number[] | null,
  options: { maxSide?: number; keepPng?: boolean } = {},
): Promise<Blob> {
  const maxSide = options.maxSide ?? PHOTO_MAX_SIDE;
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
    const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
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
    // Un logo PNG garde sa transparence (le JPEG la remplacerait par un fond noir), tant qu'il
    // tient dans la limite ; sinon repli sur le JPEG comme pour une photo.
    if (options.keepPng && file.type === "image/png") {
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (png && png.size <= PHOTO_MAX_BYTES) return png;
    }
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
// Logo du club d'un athlète : une image par nom de club exact (clé de `s.club_logos`), partagée
// par tous les athlètes du même club. Envoi (owner_type « club », kind « logo »), puis autorisation
// d'usage par la route d'approbation ; le logo n'est public qu'une fois autorisé (`club_logos_approved`).
function ClubLogo({
  club,
  s,
  refresh,
}: {
  club: string;
  s: State;
  refresh: () => Promise<void>;
}) {
  const name = club.trim();
  const [file, setFile] = useState<File>(),
    [error, setError] = useState(""),
    [consent, setConsent] = useState(false);
  useEffect(() => {
    setFile(undefined);
    setConsent(false);
    setError("");
  }, [name]);
  const current: string | undefined = name ? s.club_logos?.[name] : undefined;
  const approved = Boolean(current) && s.club_logos_approved?.[name] === current;
  return (
    <section className="photo-upload" style={{ gridColumn: "1 / -1" }}>
      <h3>Logo du club</h3>
      {!name ? (
        <p className="muted">Saisissez le club ci-dessus pour lui associer un logo.</p>
      ) : (
        <>
          <p className="muted">
            Le logo vaut pour tous les athlètes du club « {name} » (nom exact).{" "}
            {current ? (approved ? "Logo autorisé pour l'affichage public." : "Logo importé, usage pas encore autorisé.") : "Aucun logo pour ce club."}
          </p>
          {current && (
            <img
              className="photo-preview"
              src={"/api/v1/photos/" + current}
              alt={"Logo du club " + name}
            />
          )}
          <Field label="Fichier image du logo">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
          </Field>
          <small>
            Le logo est réduit dans le navigateur avant l'envoi ({LOGO_MAX_SIDE} px de côté au plus,
            1 Mo maximum) ; un PNG garde sa transparence.
          </small>
          <div className="actions">
            <AsyncButton
              disabled={!file}
              action={async () => {
                try {
                  const reduced = await reducePhoto(file!, null, { maxSide: LOGO_MAX_SIDE, keepPng: true });
                  const fd = new FormData();
                  fd.append("file", reduced, reduced.type === "image/png" ? "logo.png" : "logo.jpg");
                  fd.append("owner_type", "club");
                  fd.append("owner_id", name);
                  fd.append("kind", "logo");
                  await api("/photos", { method: "POST", body: fd });
                  setFile(undefined);
                  setConsent(false);
                  await refresh();
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {current ? "Remplacer le logo" : "Importer le logo"}
            </AsyncButton>
          </div>
          {current && !approved && (
            <>
              <Check
                label="Autorisation d'usage du logo obtenue du club"
                value={consent}
                onChange={setConsent}
              />
              <AsyncButton
                disabled={!consent}
                action={async () => {
                  try {
                    await post("/photos/" + current + "/approve", { consent: true });
                    await refresh();
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Autoriser l'affichage public du logo
              </AsyncButton>
            </>
          )}
          {error && <Notice kind="error">{error}</Notice>}
        </>
      )}
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
    blank: "Fiches de notation (bulletins vierges)",
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
          {!personalOnly && (
            <a
              className="document-link"
              href="/api/v1/print/fiche?blank=10"
              target="_blank"
              rel="noreferrer"
            >
              <span>↗</span>
              Fiches d’inscription vierges
              <small>Dix fiches à remplir à la main, pour les inscriptions sur place</small>
            </a>
          )}
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
function BatchPhotos({ s, refresh }: { s: State; refresh: () => Promise<void> }) {
  // Import en lot sans archive (PO, 26/09/2026) : plusieurs fichiers choisis d'un coup, chacun
  // réduit par le navigateur et envoyé par la route unitaire ; le consentement reste à cocher sur la fiche.
  const [lot, setLot] = useState<Reconnaissance[]>([]);
  const [resultats, setResultats] = useState<Record<string, string>>({});
  const reconnus = lot.filter((r) => r.owner);
  return (
    <Panel title="Importer un lot de photographies">
      <Notice kind="info">
        Choisissez plusieurs fichiers d’un coup. Chaque fichier est rattaché à un athlète par son nom :
        « 12.jpg » = dossard 12, ou « Prenom Nom.jpg ». Ajoutez « plein » pour une photo en pied
        (« 12-plein.jpg »), sinon c’est le portrait. Les photos sont réduites par le téléphone avant l’envoi.
        Le consentement de diffusion se coche ensuite sur chaque fiche.
      </Notice>
      <Field label="Fichiers">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            setLot(files.map((f) => reconnaitrePhoto(f, s)));
            setResultats({});
          }}
        />
      </Field>
      {lot.length > 0 && (
        <DataTable
          columns={["Fichier", "Personne", "Type", "Résultat"]}
          rows={lot.map((r) => [
            r.file.name,
            r.owner ? `${personName(r.owner)} (${r.motif})` : <span className="danger">{r.motif}</span>,
            r.kind === "full" ? "Plein pied" : "Portrait",
            resultats[r.file.name] ?? (r.owner ? "à envoyer" : "ignoré"),
          ])}
        />
      )}
      <div className="actions">
        <AsyncButton
          disabled={reconnus.length === 0}
          action={async () => {
            const out: Record<string, string> = {};
            for (const r of reconnus) {
              try {
                const reduced = await reducePhoto(r.file, null);
                const fd = new FormData();
                fd.append("file", reduced, "photo.jpg");
                fd.append("owner_type", "person");
                fd.append("owner_id", r.owner!.id);
                fd.append("kind", r.kind);
                await api("/photos", { method: "POST", body: fd });
                out[r.file.name] = "envoyée";
              } catch (e) {
                out[r.file.name] = "refusée : " + (e as Error).message;
              }
              setResultats({ ...out });
            }
            await refresh();
          }}
        >
          Importer {reconnus.length} photo{reconnus.length > 1 ? "s" : ""}
        </AsyncButton>
      </div>
    </Panel>
  );
}
