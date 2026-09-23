export function chosenRoundId(
  choice: { id: string; active: string | null } | undefined,
  active: string | null,
): string | undefined {
  return choice?.active === active ? choice.id : undefined;
}

export function landingTab(roles: string[]): string {
  return roles.some((role) => role === "judge" || role === "trainee") &&
    roles.every((role) => role === "judge" || role === "trainee")
    ? "judge"
    : "home";
}
