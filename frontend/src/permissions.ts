const admin = ["chief", "responsable", "director"];
const sport = ["chief", "responsable"];
export function canCommand(roles: string[], kind: string): boolean {
  if (
    ["paper.submit", "ballot.submit"].includes(kind) &&
    roles.includes("director")
  )
    return false;
  const chief = [
    "category.fuse",
    "user.approve",
    "round.validate",
    "round.correct",
    "overall.confirm",
    "panel.reduce",
    "round.resolve",
    "paper.submit",
    "event.purge",
    "user.update",
    "user.deactivate",
    "user.delete",
    "category.delete",
    "official.delete",
    "person.delete",
  ];
  const rules: Record<string, string[]> = {
    "user.invite": admin,
    "event.update": admin,
    "correction.sign": ["chief", "director"],
    "scene.set": [...admin, "regie"],
    "reward.update": [...admin, "secretariat"],
    "exam.program": [...sport, "commission"],
    "exam.decide": ["commission"],
    "collective.decide": admin,
    "person.save": [...admin, "secretariat"],
    "entry.save": [...admin, "secretariat"],
    "entry.remove": [...admin, "secretariat"],
    "measurement.save": [...admin, "secretariat"],
    "official.save": [...admin, "secretariat"],
  };
  const sports = [
    "jury.configure",
    "programme.generate",
    "programme.reorder",
    "bibs.assign",
    "category.save",
    "category.activate",
    "entry.late",
    "event.start",
    "event.finish",
    "event.reset",
    "round.configure",
    "round.open",
    "round.next",
    "round.incident",
    "round.absent",
    "round.present",
    "round.draw",
    "overall.create",
    "overall.final",
    "discipline.advance",
    "rewards.complete",
  ];
  const allowed = chief.includes(kind)
    ? ["chief"]
    : rules[kind] || (sports.includes(kind) ? sport : []);
  return roles.some((role) => allowed.includes(role));
}
