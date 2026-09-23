// Transitions sportives ; toutes les mutations s'exécutent dans une transaction serveur.
// Port à l'identique de `backend/fibda/workflow.py` : mêmes contrôles dans le même ordre,
// mêmes messages, mêmes codes, mêmes mutations, même forme de retour.
import { Problem } from "./problem";
import { require as requireRole, SPORT } from "./auth";
import { uid, deepcopy, find } from "./util";
import type { User } from "./state";
import { validatePanel, validateRanking, rankBallots, eliminationResult, overallCandidates } from "../domain/domain";
import { loadCatalogue } from "../domain/catalogue";

export { find };

export const PHASES: Record<string, number> = { elimination: 0, semi: 1, final: 2, overall: 3 };

// Horloge en secondes Unix (flottant), comme `time.time()` côté Python.
export type Now = number;

// `preparation.validate_confirmed_entries` n'est pas encore porté : `event.start` l'appelle via ce
// point d'accroche, que `preparation.ts` renseignera à son port. Tant qu'il est absent, `event.start`
// refuse d'ouvrir plutôt que de sauter le recontrôle des inscriptions.
import { validateConfirmedEntries } from "./preparation";
import { makeRound } from "./rounds";
export { makeRound };

const isSubset = (a: Set<string>, b: Set<string>): boolean => [...a].every((x) => b.has(x));
const isDisjoint = (a: Set<string>, b: Set<string>): boolean => ![...a].some((x) => b.has(x));
const strip = (v: unknown): string => (v == null ? "" : String(v)).trim();

export function chiefId(users: User[]): string {
  const chiefs = users.filter((u) => u.roles.includes("chief") && u.active).map((u) => u.id);
  if (chiefs.length !== 1) throw new Problem("Un chef unique est requis.");
  return chiefs[0];
}

export function eligibleIds(state: any): string[] {
  const people: Record<string, any> = Object.fromEntries(state.people.map((p: any) => [p.id, p]));
  return state.entries
    .filter((e: any) => {
      const person = people[e.person_id];
      return state.mode === "national" ? (person.nationalities ?? []).includes("CI") : person.delegation_approved && person.organizer_approved;
    })
    .map((e: any) => e.id);
}

export function officialsComplete(r: any): boolean {
  return r.panel.length > 0 && r.panel.every((j: string) => j in r.ballots);
}


export function disciplines(state: any): string[] {
  const sorted = [...state.categories].sort((a: any, b: any) => a.order - b.order);
  return [...new Set<string>(sorted.filter((c: any) => !c.archived).map((c: any) => c.discipline))];
}

export function currentDiscipline(state: any): string | null {
  return disciplines(state).find((d) => !state.discipline_progress[d]?.completed) ?? null;
}

const quotaValid = (r: any): boolean => Number.isInteger(r.quota) && 1 <= r.quota && r.quota <= r.participant_ids.length;
const CLOSED = new Set(["validated", "published"]);

export function ready(state: any, r: any): boolean {
  if (state.status !== "running" || state.active_round_id || r.status !== "pending") return false;
  if (r.discipline !== currentDiscipline(state)) return false;
  const group = state.rounds.filter((x: any) => x.discipline === r.discipline);
  if (group.some((x: any) => PHASES[x.phase] < PHASES[r.phase] && !CLOSED.has(x.status))) return false;
  if (r.dependency_id) {
    const before = find(state.rounds, r.dependency_id, "Tour précédent");
    if (!CLOSED.has(before.status)) return false;
    r.participant_ids = [...before.result.qualified];
  }
  if (r.phase === "overall" && !state.discipline_progress[r.discipline]?.category_rewards_done) return false;
  if ((r.phase === "semi" || r.phase === "elimination") && !quotaValid(r)) return false;
  return r.participant_ids.length > 0;
}

export function openRound(state: any, r: any, users: User[], now: Now): void {
  if (!ready(state, r)) throw new Problem("Ce tour attend les bulletins, qualifications ou étapes précédentes.", 409);
  validatePanel(r.panel, users);
  if ((r.phase === "semi" || r.phase === "elimination") && !quotaValid(r)) {
    throw new Problem("Le quota doit être compris entre 1 et le nombre de participants qualifiés.");
  }
  if (r.phase === "overall" && r.participant_ids.length < 2) throw new Problem("Un champion seul exige la confirmation du chef.");
  r.status = "open";
  r.opened_at = now;
  r.version += 1;
  state.active_round_id = r.id;
}

export function tryNext(state: any, users: User[], now: Now): string | null {
  const cats: Record<string, any> = Object.fromEntries(state.categories.map((c: any) => [c.id, c]));
  const order = (r: any): number => cats[r.category_id]?.order ?? 999;
  // Tri stable sur le tuple (phase, ordre de catégorie), comme `sorted` en Python.
  const sorted = [...state.rounds].sort((a: any, b: any) => PHASES[a.phase] - PHASES[b.phase] || order(a) - order(b));
  for (const r of sorted) {
    if (ready(state, r) && !(r.phase === "overall" && r.participant_ids.length < 2)) {
      openRound(state, r, users, now);
      return r.id;
    }
  }
  return null;
}

export function tick(state: any, users: User[], now: Now): boolean {
  let changed = false;
  for (const r of state.rounds) {
    if (r.status !== "open" || r.transitioned || !officialsComplete(r)) continue;
    if (r.trainee_deadline === null) {
      r.trainee_deadline = Math.max(...r.panel.map((j: string) => r.ballots[j].received_at)) + 60;
      changed = true;
    }
    const missing = r.trainees.filter((j: string) => !(j in r.ballots));
    if (missing.length && now < r.trainee_deadline) continue;
    if (missing.length) {
      r.expired_trainees = missing;
      state.alerts.push({ id: uid(), roles: ["chief", "responsable"], round_id: r.id, message: "Délai stagiaire expiré : " + missing.length + " bulletin(s) non reçu(s).", at: now });
    }
    r.transitioned = true;
    r.transitioned_at = now;
    r.status = "awaiting_validation";
    r.version += 1;
    if (state.active_round_id === r.id) state.active_round_id = null;
    changed = true;
  }
  if (state.status === "running" && !state.active_round_id) {
    if (tryNext(state, users, now)) changed = true;
  }
  return changed;
}

export function syncRewards(state: any, r: any): void {
  const previous: Record<string, any> = {};
  for (const x of state.rewards) if (x.round_id === r.id) previous[x.entry_id] = x;
  state.rewards = state.rewards.filter((x: any) => x.round_id !== r.id);
  if (r.phase !== "final" && r.phase !== "overall") return;
  for (const row of r.result.official) {
    if (row.rank > (r.phase === "overall" ? 1 : 3)) continue;
    const reward: any = {
      id: uid(),
      round_id: r.id,
      category_id: r.category_id,
      entry_id: row.entry_id,
      rank: row.rank,
      kind: r.phase,
      title: r.phase === "overall" ? "Champion overall" : row.rank + "e place",
      prepared: false,
      delivered: false,
      trophy: "",
      medal: "",
      lot: "",
      prize: "",
      currency: "XOF",
      result_version: r.result.version,
    };
    const old = previous[row.entry_id];
    if (old && old.rank === row.rank) {
      for (const k of ["id", "prepared", "delivered", "title", "trophy", "medal", "lot", "prize", "currency"]) if (k in old) reward[k] = old[k];
    }
    state.rewards.push(reward);
  }
}

export function calculate(state: any, r: any, users: User[], qualifiedIds: string[] | null = null, reason = ""): void {
  const chief = chiefId(users);
  const ballots: Record<string, any> = Object.fromEntries(r.panel.map((j: string) => [j, r.ballots[j]]));
  const old = r.result;
  const version = (old?.version ?? 0) + 1;
  if (r.phase === "elimination") {
    const result = eliminationResult(ballots, r.participant_ids, r.quota, chief);
    let qualified: string[];
    if (result.pending) {
      const selected = new Set<string>(qualifiedIds ?? []);
      const certain = new Set<string>(result.qualified);
      const tied = new Set<string>(result.tied);
      const certainOrTied = new Set<string>([...certain, ...tied]);
      if (!isSubset(certain, selected) || !isSubset(selected, certainOrTied) || selected.size < r.quota) throw new Problem("Le chef doit résoudre les ex æquo à la frontière du quota.");
      if (selected.size !== certainOrTied.size && (selected.size !== r.quota || !reason.trim())) throw new Problem("Respecter le quota exige une décision motivée ; sinon admettre tous les ex æquo.");
      qualified = r.participant_ids.filter((i: string) => selected.has(i));
    } else qualified = result.qualified;
    r.result = { common: result.counts, official: [], qualified, version, qualification_decision: reason, reference_ranking: null, reference_version: null };
  } else {
    const common = rankBallots(ballots, r.participant_ids, chief);
    const official = rankBallots(ballots, r.participant_ids, chief, eligibleIds(state));
    const qualified = r.phase === "semi" ? common.slice(0, r.quota).map((x) => x.entry_id) : [];
    r.result = {
      common,
      official,
      qualified,
      version,
      reference_ranking: [...ballots[chief].ranking],
      reference_version: ballots[chief].version,
      tie_explanation: "Somme écrêtée ; préférence majoritaire sur tous les bulletins. Dans une composante cyclique, ordre du chef.",
      chief_id: chief,
    };
  }
  r.result.validated_by = chief;
  r.result.validated_at = state._now ?? null;
  syncRewards(state, r);
}

export function applySport(state: any, actor: User, kind: string, p: any, users: User[], now: Now): any {
  state._now = now;
  try {
    return applySportInner(state, actor, kind, p, users, now);
  } finally {
    delete state._now;
  }
}

const CHIEF_ONLY = new Set(["round.validate", "round.correct", "overall.confirm", "panel.reduce", "round.resolve"]);
const PROGRAMME_PHASES = ["elimination", "semi", "final"];

function applySportInner(state: any, actor: User, kind: string, p: any, users: User[], now: Now): any {
  if (kind === "ballot.submit" || kind === "paper.submit") {
    if (actor.roles.includes("director")) throw new Problem("Le directeur ne peut pas voter.", 403);
    requireRole(actor, kind === "paper.submit" ? ["chief"] : ["chief", "responsable", "judge", "trainee"]);
    const r = find(state.rounds, p.round_id, "Tour");
    const judge: string = kind === "paper.submit" ? p.judge_id : actor.id;
    if (kind === "ballot.submit" && p.restore_id !== state.restore_id) throw new Problem("La compétition a été restaurée ; vérifiez votre brouillon.", 409);
    if (r.status !== "open" || state.active_round_id !== r.id) throw new Problem("Saisie close pour ce tour.", 409);
    if (![...r.panel, ...r.trainees].includes(judge)) throw new Problem("Vous ne jugez pas ce tour.", 403);
    if (judge in r.ballots) throw new Problem("Bulletin déjà reçu et verrouillé.", 409);
    if (r.trainees.includes(judge) && r.trainee_deadline !== null && now >= r.trainee_deadline) throw new Problem("Délai stagiaire expiré.", 409);
    if (kind === "paper.submit" && (!strip(p.signature) || !strip(p.reason))) throw new Problem("Signature papier et motif requis.");
    const key = r.phase === "elimination" ? "selected" : "ranking";
    const value: string[] = p[key] ?? [];
    if (key === "ranking") validateRanking(value, r.participant_ids);
    else if (value.length !== r.quota || new Set(value).size !== value.length || !isSubset(new Set(value), new Set<string>(r.participant_ids))) throw new Problem("La sélection doit respecter exactement le quota sans doublon.");
    r.ballots[judge] = { [key]: [...value], original: { [key]: [...value] }, received_at: now, version: 1, source: kind === "paper.submit" ? "paper" : "digital", signature: p.signature ?? null, reason: p.reason ?? null };
    tick(state, users, now);
    return { received: true, round_id: r.id, judge_id: judge, received_at: now };
  }
  requireRole(actor, CHIEF_ONLY.has(kind) ? ["chief"] : SPORT);
  if (kind === "jury.configure") {
    if (state.status !== "preparation") throw new Problem("Le jury général est figé ; configurez un tour non ouvert.");
    const panel: string[] = [...(p.panel ?? [])];
    validatePanel(panel, users);
    const trainees = validateTrainees(p.trainees ?? [], users, panel);
    const order = validateWithdrawal(p.withdrawal_order ?? [], panel, chiefId(users));
    state.jury = { panel, trainees, withdrawal_order: order };
    return {};
  }
  if (kind === "programme.generate") {
    if (state.status !== "preparation" || state.rounds.some((r: any) => r.opened_at)) throw new Problem("Un programme engagé ne peut être régénéré.");
    validatePanel(state.jury.panel, users);
    if (!state.bibs_distributed) throw new Problem("Attribuez les dossards avant de préparer les tours.");
    const rounds: any[] = [];
    for (const cat of [...state.categories].sort((a: any, b: any) => a.order - b.order)) {
      if (cat.archived) continue;
      const ids = state.entries.filter((e: any) => e.category_id === cat.id && e.confirmed).map((e: any) => e.id);
      if (!ids.length) continue;
      const n = ids.length;
      const phase: string = cat.phase_override || (n <= 6 ? "final" : n <= 15 ? "semi" : "elimination");
      let previous: string | null = null;
      for (const ph of PROGRAMME_PHASES.slice(PROGRAMME_PHASES.indexOf(phase))) {
        const quota = ph === "elimination" ? Math.min("elimination_quota" in cat ? cat.elimination_quota : 15, n) : ph === "semi" ? Math.min("quota" in cat ? cat.quota : 6, n) : null;
        const r = makeRound(state, cat, ph, previous === null ? ids : [], quota, previous);
        rounds.push(r);
        previous = r.id;
      }
    }
    state.rounds = rounds;
    state.discipline_progress = {};
    return { count: rounds.length };
  }
  if (kind === "event.start") {
    if (state.status !== "preparation") throw new Problem("La compétition est déjà engagée.");
    const checks = ["regulations_checked", "network_checked", "backup_checked"];
    if (checks.some((k) => !state.settings[k]) || !strip(state.settings.collective_tiebreak)) throw new Problem("Validez le règlement, le réseau, la sauvegarde et le critère collectif avant ouverture.");
    if (!state.rounds.length) throw new Problem("Préparez les tours avant ouverture.");
    validateConfirmedEntries(state);
    validatePanel(state.jury.panel, users);
    state.rules_snapshot = loadCatalogue();
    state.rules_version = state.rules_snapshot.version;
    state.status = "running";
    tick(state, users, now);
    return {};
  }
  if (kind === "event.finish") {
    if (state.status !== "running" || currentDiscipline(state)) throw new Problem("Toutes les disciplines et récompenses doivent être terminées.");
    state.status = "finished";
    return {};
  }
  if (kind === "round.configure") {
    const r = find(state.rounds, p.round_id, "Tour");
    if (r.status !== "pending") throw new Problem("Le tour est déjà engagé.");
    const panel: string[] = "panel" in p ? p.panel : r.panel;
    validatePanel(panel, users);
    r.panel = panel;
    r.trainees = validateTrainees("trainees" in p ? p.trainees : r.trainees, users, panel);
    if ("quota" in p && (r.phase === "semi" || r.phase === "elimination")) {
      if (!Number.isInteger(p.quota) || p.quota < 1) throw new Problem("Quota positif requis.");
      r.quota = p.quota;
    }
    r.withdrawal_order = validateWithdrawal("withdrawal_order" in p ? p.withdrawal_order : r.withdrawal_order, panel, chiefId(users));
    r.version += 1;
    return {};
  }
  if (kind === "round.open") {
    openRound(state, find(state.rounds, p.round_id, "Tour"), users, now);
    return {};
  }
  if (kind === "round.next") {
    const active = state.rounds.find((r: any) => r.id === state.active_round_id);
    if (active && (!officialsComplete(active) || (active.trainees.some((j: string) => !(j in active.ballots)) && (active.trainee_deadline === null || now < active.trainee_deadline)))) {
      throw new Problem("Des bulletins officiels ou stagiaires sont encore attendus.", 409);
    }
    tick(state, users, now);
    return {};
  }
  if (kind === "round.validate") {
    const r = find(state.rounds, p.round_id, "Tour");
    if (r.status !== "awaiting_validation" || !officialsComplete(r)) throw new Problem("Le tour attend encore ses bulletins ou une décision d’incident.");
    calculate(state, r, users, p.qualified_ids ?? null, p.reason ?? "");
    r.status = "validated";
    tick(state, users, now);
    return { result: r.result };
  }
  if (kind === "panel.reduce") {
    const r = find(state.rounds, p.round_id, "Tour");
    const remove: string[] = p.remove_ids ?? [];
    if ((r.status !== "open" && r.status !== "suspended") || !strip(p.reason)) throw new Problem("Réduction motivée uniquement pour un tour en cours.");
    if (state.active_round_id !== r.id) throw new Problem("La réduction concerne uniquement le tour actif.");
    const order = r.withdrawal_order.filter((j: string) => r.panel.includes(j));
    if (!remove.length || remove.length !== order.slice(0, remove.length).length || remove.some((j, i) => j !== order[i])) throw new Problem("Respectez l’ordre de retrait prévu.");
    const panel = r.panel.filter((j: string) => !remove.includes(j));
    validatePanel(panel, users);
    r.removed_ballots ??= {};
    for (const j of remove) if (j in r.ballots) r.removed_ballots[j] = r.ballots[j];
    for (const j of remove) delete r.ballots[j];
    r.panel = panel;
    (r.panel_changes ??= []).push({ remove_ids: remove, reason: p.reason, at: now });
    r.status = "open";
    r.version += 1;
    tick(state, users, now);
    return {};
  }
  if (kind === "round.incident" || kind === "round.resolve") {
    const r = find(state.rounds, p.round_id, "Tour");
    if (!strip(p.reason)) throw new Problem("Motif obligatoire.");
    if (kind === "round.incident") {
      if (r.status === "suspended") throw new Problem("Ce tour est déjà suspendu.");
      r.previous_status = r.status;
      r.status = "suspended";
      (r.incidents ??= []).push({ reason: p.reason, at: now, by: actor.id });
    } else {
      if (r.status !== "suspended") throw new Problem("Aucun incident à résoudre.");
      r.status = r.previous_status ?? "open";
      r.incidents[r.incidents.length - 1].resolution = { reason: p.reason, at: now, by: actor.id };
      tick(state, users, now);
    }
    return {};
  }
  if (kind === "round.correct") {
    const r = find(state.rounds, p.round_id, "Tour");
    const j: string = p.judge_id;
    if (!["validated", "published", "awaiting_validation"].includes(r.status) || !(j in r.ballots)) throw new Problem("Ce bulletin ne peut pas être rectifié dans cet état.");
    if (!strip(p.reason)) throw new Problem("Motif obligatoire.");
    // Une qualification déjà utilisée exige une décision d'incident, pas un changement silencieux des finalistes.
    correctionAllowed(state, r);
    const key = r.phase === "elimination" ? "selected" : "ranking";
    const value: string[] = p[key] ?? [];
    if (key === "ranking") validateRanking(value, r.participant_ids);
    else if (value.length !== r.quota || new Set(value).size !== value.length || !isSubset(new Set(value), new Set<string>(r.participant_ids))) throw new Problem("Sélection corrigée invalide.");
    const published = r.status === "published" || (r.has_been_published ?? false);
    r.correction = { judge_id: j, [key]: [...value], reason: p.reason, signatures: [actor.id], published, at: now, qualified_ids: p.qualified_ids ?? null };
    if (!published) applyCorrection(state, r, users, now);
    return { pending_signatures: Boolean(r.correction) };
  }
  if (kind === "rewards.complete") {
    const d: string = p.discipline;
    const stage: string | undefined = p.kind;
    if (d !== currentDiscipline(state) || (stage !== "category" && stage !== "overall")) throw new Problem("Étape de récompense invalide.");
    const phase = stage === "category" ? "final" : "overall";
    const rounds = state.rounds.filter((r: any) => r.discipline === d && r.phase === phase);
    if (rounds.some((r: any) => !["validated", "published", "no_title"].includes(r.status))) throw new Problem("Validez les résultats avant la fin des récompenses.");
    const progress = (state.discipline_progress[d] ??= {});
    if (stage === "overall") {
      const sections = new Set<string>(state.categories.filter((c: any) => c.discipline === d && !c.archived).map((c: any) => c.section));
      if (!isSubset(sections, new Set<string>(progress.overall_sections ?? []))) throw new Problem("Constituez chaque overall avant de terminer ses récompenses.");
    }
    progress[stage + "_rewards_done"] = true;
    return {};
  }
  if (kind === "overall.create") {
    const d: string = p.discipline;
    const section: string = p.section;
    const progress = (state.discipline_progress[d] ??= {});
    if (d !== currentDiscipline(state) || !progress.category_rewards_done) throw new Problem("Terminez les récompenses des catégories avant l’overall.");
    if ((section !== "amateur" && section !== "pro") || (progress.overall_sections ?? []).includes(section)) throw new Problem("Overall déjà constitué ou section invalide.");
    const finals = state.rounds.filter((r: any) => r.discipline === d && r.section === section && r.phase === "final");
    if (finals.some((r: any) => !CLOSED.has(r.status))) throw new Problem("Toutes les finales doivent être validées.");
    const rows = finals.flatMap((r: any) => r.result.official);
    let ids: string[] = overallCandidates(rows, state.entries, eligibleIds(state));
    const absent = new Set<string>(p.absent_ids ?? []);
    if (!isSubset(absent, new Set(ids))) throw new Problem("Absence overall inconnue.");
    ids = ids.filter((i) => !absent.has(i));
    const cat = { id: "overall-" + d + "-" + section, discipline: d, section };
    const r = makeRound(state, cat, "overall", ids);
    r.absent_ids = [...absent];
    const examIds: unknown = p.exam_user_ids ?? [];
    if (!Array.isArray(examIds) || examIds.length !== new Set(examIds).size || !isSubset(new Set(examIds), new Set<string>([...r.panel, ...r.trainees]))) {
      throw new Problem("Les candidats doivent être attendus sur cet overall, sans doublon.");
    }
    for (const userId of examIds as string[]) {
      const candidate = find(users as any[], userId, "Candidat");
      if (isDisjoint(new Set<string>(candidate.roles), new Set(["trainee", "judge", "responsable"]))) throw new Problem("Ce profil n’est pas candidat à une comparaison.");
      let program = state.exam_programs.find((x: any) => x.user_id === userId);
      if (program === undefined) {
        program = { user_id: userId, round_ids: [], version: 0 };
        state.exam_programs.push(program);
      }
      program.round_ids.push(r.id);
      program.version += 1;
    }
    if (!ids.length) r.status = "no_title";
    state.rounds.push(r);
    (progress.overall_sections ??= []).push(section);
    tick(state, users, now);
    return { round_id: r.id, champions: ids.length };
  }
  if (kind === "overall.confirm") {
    const r = find(state.rounds, p.round_id, "Tour");
    if (r.phase !== "overall" || r.participant_ids.length !== 1 || r.status !== "pending") throw new Problem("Confirmation réservée à un overall d’un seul champion.");
    r.result = { common: [], official: [{ entry_id: r.participant_ids[0], rank: 1, total: null }], qualified: [], version: 1, validated_by: actor.id, reference_ranking: null, reference_version: null, single_champion: true };
    r.status = "validated";
    r.transitioned = true;
    syncRewards(state, r);
    return {};
  }
  if (kind === "discipline.advance") {
    const d: string = p.discipline;
    const progress = (state.discipline_progress[d] ??= {});
    if (d !== currentDiscipline(state) || !progress.category_rewards_done || !progress.overall_rewards_done || state.active_round_id) throw new Problem("Terminez les deux étapes de récompenses et l’overall.");
    progress.completed = true;
    tick(state, users, now);
    return {};
  }
  throw new Problem("Commande sportive inconnue.", 404);
}

export function validateTrainees(ids: string[], users: User[], panel: string[]): string[] {
  if (ids.length !== new Set(ids).size || !isDisjoint(new Set(ids), new Set(panel))) throw new Problem("Un juge ne figure qu’une fois dans le tour.");
  for (const i of ids) {
    const u = find(users as any[], i, "Stagiaire");
    if (!u.roles.includes("trainee") || !u.approved || !u.active) throw new Problem("Stagiaire non habilité.");
  }
  return [...ids];
}

export function validateWithdrawal(ids: string[], panel: string[], chief: string): string[] {
  if (ids.length !== new Set(ids).size || !isSubset(new Set(ids), new Set(panel)) || ids.includes(chief)) throw new Problem("Ordre de retrait invalide ; le chef reste dans le panel.");
  return [...ids];
}

export function correctionAllowed(state: any, r: any): void {
  if (!["validated", "published", "awaiting_validation"].includes(r.status)) {
    throw new Problem("Résolvez l’incident avant de rectifier ce tour.", 409);
  }
  if (state.rounds.some((x: any) => x.dependency_id === r.id && x.status !== "pending")) {
    throw new Problem("La qualification a déjà servi : traitement d’incident requis, sans modification automatique du tour dépendant.", 409);
  }
  if (r.phase === "final" && state.rounds.some((x: any) => x.phase === "overall" && x.discipline === r.discipline && x.section === r.section)) {
    throw new Problem("L’overall est déjà constitué : traitement d’incident requis avant toute correction de sa finale source.", 409);
  }
}

export function applyCorrection(state: any, r: any, users: User[], now: Now): void {
  correctionAllowed(state, r);
  const correction = r.correction;
  const j: string = correction.judge_id;
  const b = r.ballots[j];
  const key = r.phase === "elimination" ? "selected" : "ranking";
  (r.history ??= []).push({ result: deepcopy(r.result), ballot: deepcopy(b), correction: deepcopy(correction) });
  b[key] = correction[key];
  b.version += 1;
  (b.corrections ??= []).push(correction);
  calculate(state, r, users, correction.qualified_ids ?? null, correction.reason);
  r.result.validated_at = now;
  r.correction = null;
  r.status = "validated";
  r.version += 1;
  r.reveals = {};
  // Les annonces antérieures sont retirées ; la régie publie la nouvelle version consciemment.
  for (const [screen, scene] of Object.entries<any>(state.public)) {
    if (scene.round_id === r.id) state.public[screen] = { kind: "idle", notice: "Résultat en cours de mise à jour" };
  }
}
