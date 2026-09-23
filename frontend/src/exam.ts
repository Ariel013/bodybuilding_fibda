import type { Entity } from "./types";
export function overallExamCandidates(
  users: Entity[],
  traineeIds: string[],
): Entity[] {
  return users.filter(
    (user) =>
      traineeIds.includes(user.id) &&
      user.approved &&
      user.roles?.includes("trainee") &&
      !user.roles.includes("director"),
  );
}
export function selectedOverallExams(
  selected: string[],
  candidates: Entity[],
): string[] {
  const allowed = new Set(candidates.map((user) => user.id));
  return [...new Set(selected)].filter((id) => allowed.has(id));
}
