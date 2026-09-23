// Page « Aide » : rend src/aide/MODE-D-EMPLOI.md (source unique, lien symbolique dans docs/) filtré par les rôles de la
// personne connectée. Rendu en éléments React uniquement — aucun HTML injecté.
import { useMemo, useState, type ReactNode } from "react";
import manuel from "./aide/MODE-D-EMPLOI.md?raw";
import {
  parseManuel,
  sectionsPourRoles,
  libelleProfil,
  type Block,
  type Run,
  type Section,
} from "./aide";
import { labels } from "./types";

const sectionsCompletes = parseManuel(manuel);

function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((r, i) =>
        r.strong ? (
          <strong key={i}>{r.text}</strong>
        ) : (
          <span key={i}>{r.text}</span>
        ),
      )}
    </>
  );
}

function Bloc({ block }: { block: Block }) {
  if (block.type === "heading3")
    return (
      <h3>
        <Runs runs={block.runs} />
      </h3>
    );
  if (block.type === "paragraph")
    return (
      <p>
        <Runs runs={block.runs} />
      </p>
    );
  const items = block.items.map((item, i) => (
    <li key={i}>
      <Runs runs={item} />
    </li>
  ));
  return block.type === "ordered" ? <ol>{items}</ol> : <ul>{items}</ul>;
}

function SectionAide({ section }: { section: Section }) {
  return (
    <section className="aide-section" id={"aide-" + section.id}>
      {section.intro ? (
        <h1>{section.title}</h1>
      ) : (
        <h2>
          {libelleProfil(section)}
          {!section.roles.includes("tous") && (
            <small>
              {section.roles.map((r) => labels[r] || r).join(" · ")}
            </small>
          )}
        </h2>
      )}
      {section.blocks.map((b, i) => (
        <Bloc key={i} block={b} />
      ))}
    </section>
  );
}

/**
 * `roles` absent : écran de connexion (intro + « Tous les profils » seulement, sans bouton).
 */
export function Aide({
  roles,
  titre,
}: {
  roles?: string[];
  titre?: ReactNode;
}) {
  const [tous, setTous] = useState(false);
  const sections = useMemo(
    () =>
      tous && roles
        ? sectionsCompletes
        : sectionsPourRoles(sectionsCompletes, roles || []),
    [roles, tous],
  );
  const sommaire = sections.filter((s) => !s.intro);
  const aller = (id: string) =>
    document
      .getElementById("aide-" + id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="aide">
      {titre}
      {roles && (
        <div className="aide-filtre">
          <p>
            {tous
              ? "Toutes les sections du mode d’emploi sont affichées."
              : "Sections adaptées à vos rôles : " +
                (roles.map((r) => labels[r] || r).join(", ") || "aucun") +
                "."}
          </p>
          <button className="ghost" onClick={() => setTous((v) => !v)}>
            {tous ? "Voir seulement mon profil" : "Voir tous les profils"}
          </button>
        </div>
      )}
      {sommaire.length > 0 && (
        <nav className="aide-sommaire" aria-label="Sommaire du mode d’emploi">
          <p className="eyebrow">SOMMAIRE</p>
          <ul>
            {sommaire.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => aller(s.id)}
                >
                  {libelleProfil(s)}
                </button>
                {s.blocks.some((b) => b.type === "heading3") && (
                  <ul>
                    {s.blocks
                      .filter((b) => b.type === "heading3")
                      .map((b, i) => (
                        <li key={i}>{(b as { text: string }).text}</li>
                      ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
      {sections.map((s) => (
        <SectionAide key={s.id} section={s} />
      ))}
    </div>
  );
}
