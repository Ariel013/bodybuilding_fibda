import type { Entity } from "./types";
export function projectionGroup(
  entries: Entity[],
  scene: any,
  round?: any,
): string[] {
  if (round) return [...(round.participant_ids || [])];
  return entries
    .filter((e) => e.category_id === scene.category_id && e.confirmed !== false)
    .map((e) => e.id);
}
export function photoMode(groupSize: number): "portrait" | "full" {
  return groupSize > 15 ? "portrait" : "full";
}
export function photoFor(
  person: any,
  mode: "portrait" | "full",
  privatePreview = false,
): string | undefined {
  if (!person?.photo_approved || !person?.photo_consent) return undefined;
  const choices =
    mode === "portrait"
      ? [person.photo_portrait, person.photo_full]
      : [person.photo_full, person.photo_portrait];
  return choices.find(
    (id) =>
      id &&
      ((!privatePreview && !Array.isArray(person.approved_photo_ids)) ||
        person.approved_photo_ids?.includes(id)),
  );
}
export function shouldAnimateScene(
  previous: string | undefined,
  next: string,
  kind: string,
): boolean {
  return previous !== undefined && previous !== next && kind === "qualifiers";
}
