export type Ranking = (string | null)[];
/** A replacement frees the previous occupant and never shifts another rank. */
export function place(ranking: Ranking, id: string, rank: number): Ranking {
  if (rank < 0 || rank >= ranking.length) return [...ranking];
  const next = ranking.map((value) => (value === id ? null : value));
  next[rank] = id;
  return next;
}
export function remove(ranking: Ranking, id: string): Ranking {
  return ranking.map((v) => (v === id ? null : v));
}
export function complete(ranking: Ranking, participants: string[]): boolean {
  return (
    ranking.length === participants.length &&
    ranking.every((v): v is string => v !== null && participants.includes(v)) &&
    new Set(ranking).size === participants.length
  );
}
export function selectionValid(
  selection: string[],
  participants: string[],
  quota: number,
) {
  return (
    selection.length === quota &&
    new Set(selection).size === quota &&
    selection.every((id) => participants.includes(id))
  );
}
export function draftKey(
  event: string,
  restore: string,
  judge: string,
  round: string,
  version: number,
) {
  return [event, restore, judge, round, version]
    .map(encodeURIComponent)
    .join(":");
}
export function secondsRemaining(
  deadline: number | null | undefined,
  serverNow: number,
) {
  return deadline == null ? null : Math.max(0, Math.ceil(deadline - serverNow));
}
/** Bascule un dossard dans la sélection d'une éliminatoire, sans dépasser le quota. */
export function toggleSelection(
  selected: string[],
  id: string,
  quota: number,
): string[] {
  return selected.includes(id)
    ? selected.filter((v) => v !== id)
    : addSelection(selected, id, quota);
}
/** Ajoute un dossard à la sélection ; refus silencieux (même liste) au-delà du quota ou en doublon. */
export function addSelection(
  selected: string[],
  id: string,
  quota: number,
): string[] {
  if (selected.includes(id) || selected.length >= quota) return selected;
  return [...selected, id];
}
/** Un déplacement du pointeur n'est un glissement qu'au-delà d'un seuil (6 px), pour distinguer du toucher. */
export function isDragMove(dx: number, dy: number, threshold = 6): boolean {
  return Math.hypot(dx, dy) > threshold;
}
export type DropTarget = { kind: "rank"; rank: number } | { kind: "selected" };
/** Cible de dépôt déduite des attributs `data-rank` (rang) ou `data-drop="selected"` (éliminatoire). */
export function dropTarget(
  data: { rank?: string; drop?: string } | undefined,
  size: number,
): DropTarget | null {
  if (!data) return null;
  if (data.drop === "selected") return { kind: "selected" };
  if (data.rank === undefined || data.rank === "") return null;
  const rank = Number(data.rank);
  if (!Number.isInteger(rank) || rank < 0 || rank >= size) return null;
  return { kind: "rank", rank };
}
/**
 * Défilement automatique pendant un glissement : déplacement (px) à appliquer quand le pointeur
 * approche d'un bord de la zone [start, end]. Négatif vers le haut, positif vers le bas, 0 au centre.
 */
export function autoScrollStep(
  pointer: number,
  start: number,
  end: number,
  margin = 56,
  max = 14,
): number {
  if (end - start <= margin * 2) return 0;
  if (pointer < start + margin)
    return -Math.ceil(((start + margin - pointer) / margin) * max);
  if (pointer > end - margin)
    return Math.ceil(((pointer - (end - margin)) / margin) * max);
  return 0;
}
