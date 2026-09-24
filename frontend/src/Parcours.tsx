// Onglet Parcours (demande du PO, 24/09/2026) : les étapes de la compétition dans l'ordre
// réel, avec pour chacune son état, son bouton et ses documents. La logique d'état vit dans
// parcours.ts (pure, testée) ; ce fichier ne fait que l'afficher et exécuter les actions.
import { useState } from "react";
import { type State, type Command } from "./types";
import { canCommand } from "./permissions";
import { download } from "./api";
import { Notice, Status } from "./ui";
import { etapes, type Etape, type Action, type SousEtape } from "./parcours";
import "./parcours.css";

const ETATS: Record<Etape["etat"], string> = {
  fait: "Fait",
  en_cours: "À faire maintenant",
  bloque: "Bloqué",
  a_venir: "À venir",
};

export function Parcours({ s, command }: { s: State; command: Command }) {
  const roles = s.me.roles || [];
  const liste = etapes(s, roles);
  const enCours = liste.find((e) => e.etat === "en_cours");
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">LE FIL DE VOTRE COMPÉTITION</p>
          <h1>Parcours</h1>
          <p>
            {enCours
              ? `Étape ${enCours.numero} : ${enCours.titre}`
              : s.status === "finished"
                ? "Compétition terminée : toutes les étapes sont faites."
                : "Aucune étape à faire maintenant."}
          </p>
        </div>
        <Status value={s.status} />
      </div>
      <Notice>
        Les étapes suivent l’ordre imposé par le serveur ; chaque bouton agit
        sur place et les rubriques restent accessibles pour sortir du parcours.
        Une action n’est enregistrée qu’après « Modification enregistrée sur le
        serveur ».
      </Notice>
      <ol className="parcours" aria-label="Étapes de la compétition">
        {liste.map((e) => (
          <EtapeCarte key={e.id} etape={e} roles={roles} command={command} />
        ))}
      </ol>
    </>
  );
}

function EtapeCarte({
  etape: e,
  roles,
  command,
}: {
  etape: Etape;
  roles: string[];
  command: Command;
}) {
  return (
    <li
      className={"parcours-etape " + e.etat}
      aria-current={e.etat === "en_cours" ? "step" : undefined}
    >
      <div className="parcours-numero" aria-hidden="true">
        {e.etat === "fait" ? "✓" : e.numero}
      </div>
      <div className="parcours-corps">
        <div className="parcours-tete">
          <h2>{e.titre}</h2>
          <span className={"parcours-etat " + e.etat}>{ETATS[e.etat]}</span>
        </div>
        <p className="parcours-description">{e.description}</p>
        {e.raison && (
          <p className="parcours-raison">
            Bloqué : {e.raison.charAt(0).toUpperCase() + e.raison.slice(1)}.
          </p>
        )}
        {e.details.map((d, i) => (
          <p className="parcours-detail" key={i}>
            {d}
          </p>
        ))}
        {e.sousEtapes && (
          <ul className="parcours-sous">
            {e.sousEtapes.map((x) => (
              <SousEtapeLigne
                key={x.libelle}
                sous={x}
                roles={roles}
                command={command}
              />
            ))}
          </ul>
        )}
        {e.principale && !e.sousEtapes && (
          <div className="parcours-principale">
            <ActionBouton
              action={e.principale}
              roles={roles}
              command={command}
              principale
              inactive={e.etat === "bloque"}
            />
          </div>
        )}
        {e.contextuelles.length > 0 && (
          <div className="parcours-contextuelles">
            {e.contextuelles.map((a, i) => (
              <ActionBouton
                key={i}
                action={a}
                roles={roles}
                command={command}
              />
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function SousEtapeLigne({
  sous,
  roles,
  command,
}: {
  sous: SousEtape;
  roles: string[];
  command: Command;
}) {
  return (
    <li className={sous.fait ? "fait" : sous.raison ? "bloque" : "a_faire"}>
      <span className="parcours-sous-coche" aria-hidden="true">
        {sous.fait ? "✓" : "○"}
      </span>
      <span className="parcours-sous-libelle">{sous.libelle}</span>
      {sous.fait ? (
        <span className="parcours-sous-etat">Fait</span>
      ) : sous.raison ? (
        <span className="parcours-sous-etat">{sous.raison}</span>
      ) : (
        sous.action && (
          <ActionBouton
            action={sous.action}
            roles={roles}
            command={command}
            principale
          />
        )
      )}
    </li>
  );
}

/**
 * Un bouton par genre d'action : commande exécutée sur place (refus serveur affiché tel quel
 * sous le bouton), lien vers un onglet ou un document imprimable, ou sauvegarde téléchargée.
 */
function ActionBouton({
  action,
  roles,
  command,
  principale = false,
  inactive = false,
}: {
  action: Action;
  roles: string[];
  command: Command;
  principale?: boolean;
  inactive?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const classe = principale ? "" : "ghost";
  if (action.genre === "lien") {
    return (
      <a
        className={"button " + classe}
        href={action.href}
        target={action.externe ? "_blank" : undefined}
        rel={action.externe ? "noreferrer" : undefined}
      >
        {action.externe ? "↗ " : ""}
        {action.libelle}
      </a>
    );
  }
  if (action.genre === "sauvegarde") {
    // Réservé au chef et au directeur, comme le panneau « Sauvegarde et restauration ».
    if (!roles.includes("chief") && !roles.includes("director")) return null;
    return (
      <span className="parcours-action">
        <button
          type="button"
          className={classe}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErreur("");
            try {
              await download("/backup", "fibda-sauvegarde.json", "POST");
            } catch (err) {
              setErreur((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "En cours…" : "⤓ " + action.libelle}
        </button>
        {erreur && <small className="parcours-erreur">{erreur}</small>}
      </span>
    );
  }
  if (!canCommand(roles, action.type)) {
    return (
      <span className="parcours-action">
        <small className="parcours-reserve">
          « {action.libelle} » : réservé{" "}
          {action.type === "round.validate" || action.type === "overall.confirm"
            ? "au chef de jury"
            : "au chef ou au responsable"}
          .
        </small>
      </span>
    );
  }
  return (
    <span className="parcours-action">
      <button
        type="button"
        className={classe}
        disabled={busy || inactive || !!action.raison}
        onClick={async () => {
          setBusy(true);
          setErreur("");
          try {
            await command(action.type, action.payload ?? {});
          } catch (err) {
            // Message du serveur, tel quel, sous le bouton (il est aussi repris en tête de page).
            setErreur((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "En cours…" : action.libelle}
      </button>
      {action.raison && (
        <small className="parcours-reserve">{action.raison}</small>
      )}
      {erreur && <small className="parcours-erreur">{erreur}</small>}
    </span>
  );
}
