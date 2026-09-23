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
