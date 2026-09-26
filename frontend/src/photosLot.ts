import type { Entity } from "./types";

/** Nom normalisé pour comparer un nom de fichier à une personne : minuscules, sans accent ni ponctuation. */
export const normaliser = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export type Reconnaissance = { file: File; owner: Entity | null; kind: "portrait" | "full"; motif: string };
type Carnet = { entries: Entity[]; people: Entity[] };

/**
 * Reconnaît la personne visée par un nom de fichier (import en lot, PO 26/09/2026) : « 12.jpg » ou
 * « N12-plein.jpg » = dossard 12 ; sinon « Prenom Nom.jpg » ou « Nom Prenom.jpg » (accents et casse
 * ignorés). Le suffixe « plein » ou « full » désigne la photo en pied, sinon le portrait.
 */
export function reconnaitrePhoto(file: File, s: Carnet): Reconnaissance {
  const base = file.name.replace(/\.[^.]+$/, "");
  const kind: "portrait" | "full" = /(^|[^a-z])(plein|full)([^a-z]|$)/i.test(base) ? "full" : "portrait";
  const num = base.match(/^\s*(?:n[°o]?\s*)?(\d{1,4})(?![\d])/i);
  if (num) {
    const bib = Number(num[1]);
    const entry = s.entries.find((e) => Number(e.bib) === bib);
    const owner = entry ? (s.people.find((p) => p.id === entry.person_id) ?? null) : null;
    return { file, owner, kind, motif: owner ? `dossard ${bib}` : `dossard ${bib} inconnu` };
  }
  const cle = normaliser(base.replace(/(plein|full)/gi, " "));
  const owner =
    s.people.find((p) => {
      const a = normaliser(`${p.first_name} ${p.last_name}`);
      const b = normaliser(`${p.last_name} ${p.first_name}`);
      return cle === a || cle === b;
    }) ?? null;
  return { file, owner, kind, motif: owner ? "nom reconnu" : "nom non reconnu" };
}
