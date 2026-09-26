// Transitions sportives ; toutes les mutations s'exécutent dans une transaction serveur.
// Port à l'identique de `backend/fibda/workflow.py` : mêmes contrôles dans le même ordre,
// mêmes messages, mêmes codes, mêmes mutations, même forme de retour.
import { randomInt } from "node:crypto";
import { Problem } from "./problem";
import { require as requireRole, SPORT } from "./auth";
import { uid, deepcopy, find } from "./util";
import type { User } from "./state";
import { validatePanel, validateRanking, rankBallots, eliminationResult, overallCandidates } from "../domain/domain";
import { loadCatalogue } from "../domain/catalogue";

export { find };

// Motif libre saisi par un utilisateur : nettoyé et borné, il entre dans l'état, l'audit et chaque projection.
export function motif(value: unknown): string {
  const s = strip(value == null ? "" : String(value));
  if (s.length > 500) throw new Problem("Motif trop long : 500 caractères au maximum.");
  return s;
}

export const PHASES: Record<string, number> = { elimination: 0, semi: 1, final: 2, overall: 3 };

// Horloge en secondes Unix (flottant), comme `time.time()` côté Python.
export type Now = number;

// `preparation.validate_confirmed_entries` n'est pas encore porté : `event.start` l'appelle via ce
// point d'accroche, que `preparation.ts` renseignera à son port. Tant qu'il est absent, `event.start`
// refuse d'ouvrir plutôt que de sauter le recontrôle des inscriptions.
import { validateConfirmedEntries, categoryActive } from "./preparation";
import { makeRound } from "./rounds";
export { makeRound };

const isSubset = (a: Set<string>, b: Set<string>): boolean => [...a].every((x) => b.has(x));
const isDisjoint = (a: Set<string>, b: Set<string>): boolean => ![...a].some((x) => b.has(x));
const strip = (v: unknown): string => (v == null ? "" : String(v)).trim();

/** Chef de jury d'un panel : l'unique membre du panel portant le rôle chef (plusieurs chefs peuvent exister, PO 26/09/2026). */
export function chiefOfPanel(panel: string[], users: User[]): string {
  const chiefs = panel.filter((id) => users.some((u) => u.id === id && u.roles.includes("chief") && u.active));
  if (chiefs.length !== 1) throw new Problem("Un chef de jury est requis dans le panel.");
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
  return [...new Set<string>(sorted.filter((c: any) => categoryActive(c)).map((c: any) => c.discipline))];
}

export function currentDiscipline(state: any): string | null {
  return disciplines(state).find((d) => !state.discipline_progress[d]?.completed) ?? null;
}

const quotaValid = (r: any): boolean => Number.isInteger(r.quota) && 1 <= r.quota && r.quota <= r.participant_ids.length;
const CLOSED = new Set(["validated", "published"]);

// --- Ordre de passage sur scène -------------------------------------------------------------
// Demande PO du 24/09/2026 : l'ordre de passage est tiré au sort à chaque tour, parmi les athlètes
// encore en lice de ce tour (après qualification et absences). Il ne sert qu'à l'appel sur scène :
// aucun calcul sportif ne le lit.

// Mélange de Fisher-Yates avec l'aléa cryptographique de Node (jamais `Math.random`).
export function drawPassageOrder(ids: string[]): string[] {
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Un tirage n'est valable que s'il est une permutation exacte des participants du moment.
export function passageOrderValid(r: any): boolean {
  const order: string[] = r.passage_order ?? [];
  const ids: string[] = r.participant_ids ?? [];
  return order.length > 0 && order.length === ids.length && new Set(order).size === order.length && order.every((i) => ids.includes(i));
}

function recordDraw(r: any, now: Now, by: string | null): void {
  r.passage_order = drawPassageOrder(r.participant_ids);
  (r.draws ??= []).push({ at: now, by, automatic: by === null });
}

// Participants d'un tour dépendant : les qualifiés du tour précédent clos, moins les absents déclarés.
// Un athlète déclaré absent (round.absent) ne revient pas par la qualification du tour précédent.
function refreshParticipants(state: any, r: any): boolean {
  if (!r.dependency_id) return true;
  const before = find(state.rounds, r.dependency_id, "Tour précédent");
  if (!CLOSED.has(before.status)) return false;
  const absent = new Set<string>(r.absent_ids ?? []);
  r.participant_ids = before.result.qualified.filter((i: string) => !absent.has(i));
  return true;
}

export function ready(state: any, r: any, force = false): boolean {
  if (state.status !== "running" || state.active_round_id || r.status !== "pending") return false;
  // Overall final (toutes disciplines) : prêt dès que toutes les disciplines sont terminées.
  if (r.grand_final) return currentDiscipline(state) === null;
  // Ouverture forcée (PO, 26/09/2026, en cours de compétition) : le chef ou le responsable ouvre une
  // manche hors de l'ordre préétabli (autre discipline, autre phase). Ce qui ne se force jamais : une
  // autre manche ouverte, des participants encore inconnus (demi-finale non validée), un quota invalide.
  if (!force) {
    if (r.discipline !== currentDiscipline(state)) return false;
    const group = state.rounds.filter((x: any) => x.discipline === r.discipline);
    if (group.some((x: any) => PHASES[x.phase] < PHASES[r.phase] && !CLOSED.has(x.status))) return false;
  }
  if (!refreshParticipants(state, r)) return false;
  // PO 26/09/2026 : l'overall s'ouvre dès les finales validées, sans attendre la confirmation des remises.
  if ((r.phase === "semi" || r.phase === "elimination") && !quotaValid(r)) return false;
  return r.participant_ids.length > 0;
}

export function openRound(state: any, r: any, users: User[], now: Now, force = false): void {
  if (!ready(state, r, force)) throw new Problem(force ? "Impossible d’ouvrir cette manche : une autre manche est ouverte, ou ses participants ne sont pas encore connus." : "Ce tour attend les bulletins, qualifications ou étapes précédentes.", 409);
  validatePanel(r.panel, users);
  if ((r.phase === "semi" || r.phase === "elimination") && !quotaValid(r)) {
    throw new Problem("Le quota doit être compris entre 1 et le nombre de participants qualifiés.");
  }
  if (r.phase === "overall" && r.participant_ids.length < 2) throw new Problem("Un champion seul exige la confirmation du chef.");
  r.status = "open";
  r.opened_at = now;
  // Tirage automatique de l'ordre de passage sur les participants du moment ; un tirage manuel
  // (round.draw) fait avant l'ouverture sur le même effectif est conservé.
  if (!passageOrderValid(r)) recordDraw(r, now, null);
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
  if (state.status === "running" && autoOveralls(state, now)) changed = true;
  if (state.status === "running" && !state.active_round_id) {
    if (tryNext(state, users, now)) changed = true;
  }
  return changed;
}

/**
 * Overall automatique (PO, 26/09/2026) : dès que toutes les finales d'une discipline et d'une section
 * sont validées, l'overall de cette discipline se crée avec le premier de chaque classe, sans attendre
 * la confirmation des remises. Idempotent : une section déjà constituée n'est jamais recréée ; une
 * discipline sans finale n'a pas d'overall. `overall.create` reste disponible à la main (absents, examens).
 */
export function autoOveralls(state: any, _now: Now): boolean {
  let changed = false;
  // Toutes les disciplines (une manche peut être ouverte hors ordre), pas seulement la courante.
  for (const d of disciplines(state)) {
  const progress = (state.discipline_progress[d] ??= {});
  const sections = new Set<string>(state.categories.filter((c: any) => c.discipline === d && categoryActive(c)).map((c: any) => c.section));
  for (const section of sections) {
    if ((progress.overall_sections ?? []).includes(section)) continue;
    if (state.rounds.some((r: any) => r.phase === "overall" && r.discipline === d && r.section === section)) continue;
    const finals = state.rounds.filter((r: any) => r.discipline === d && r.section === section && r.phase === "final");
    if (!finals.length || finals.some((r: any) => !CLOSED.has(r.status))) continue;
    const rows = finals.flatMap((r: any) => r.result.official);
    const ids: string[] = overallCandidates(rows, state.entries, eligibleIds(state));
    const r = makeRound(state, { id: "overall-" + d + "-" + section, discipline: d, section }, "overall", ids);
    r.absent_ids = [];
    r.auto_created = true;
    if (!ids.length) r.status = "no_title";
    state.rounds.push(r);
    (progress.overall_sections ??= []).push(section);
    changed = true;
  }
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
      title: r.grand_final ? "Champion overall toutes disciplines" : r.phase === "overall" ? "Champion overall" : row.rank + "e place",
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
  const chief = chiefOfPanel(r.panel, users);
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

const CHIEF_ONLY = new Set(["round.validate", "round.correct", "overall.confirm", "panel.reduce", "round.resolve", "event.reset"]);
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
    r.ballots[judge] = { [key]: [...value], original: { [key]: [...value] }, received_at: now, version: 1, source: kind === "paper.submit" ? "paper" : "digital", signature: p.signature ?? null, reason: p.reason ? motif(p.reason) : null };
    tick(state, users, now);
    return { received: true, round_id: r.id, judge_id: judge, received_at: now };
  }
  requireRole(actor, CHIEF_ONLY.has(kind) ? ["chief"] : SPORT);
  if (kind === "jury.configure") {
    if (state.status !== "preparation") throw new Problem("Le jury général est figé ; configurez un tour non ouvert.");
    const panel: string[] = [...(p.panel ?? [])];
    validatePanel(panel, users);
    const trainees = validateTrainees(p.trainees ?? [], users, panel);
    const order = validateWithdrawal(p.withdrawal_order ?? [], panel, chiefOfPanel(panel, users));
    state.jury = { panel, trainees, withdrawal_order: order };
    return {};
  }
  if (kind === "programme.generate") {
    if (state.status !== "preparation" || state.rounds.some((r: any) => r.opened_at)) throw new Problem("Un programme engagé ne peut être régénéré.");
    validatePanel(state.jury.panel, users);
    if (!state.bibs_distributed) throw new Problem("Attribuez les dossards avant de préparer les tours.");
    const rounds: any[] = [];
    for (const cat of [...state.categories].sort((a: any, b: any) => a.order - b.order)) {
      if (!categoryActive(cat)) continue; // archivée ou désactivée : aucune manche
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
    // Ordre réel de jeu (règle FIBDA, PO 26/09/2026) : par discipline, toutes les éliminatoires, puis
    // toutes les demi-finales, puis toutes les finales ; les documents lisent cet ordre.
    const disciplineRank = new Map<string, number>();
    for (const cat of [...state.categories].sort((a: any, b: any) => a.order - b.order)) if (!disciplineRank.has(cat.discipline)) disciplineRank.set(cat.discipline, disciplineRank.size);
    const catOrder = (id: string): number => state.categories.find((c: any) => c.id === id)?.order ?? 999;
    rounds.sort((a, b) => (disciplineRank.get(a.discipline) ?? 99) - (disciplineRank.get(b.discipline) ?? 99) || PHASES[a.phase] - PHASES[b.phase] || catOrder(a.category_id) - catOrder(b.category_id));
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
  if (kind === "event.reset") {
    // Retour en préparation (PO, 24/09/2026) : pour rejouer un lancement après des essais, sans vider
    // la base. Comptes, athlètes, catégories, dossards et jury sont conservés ; manches, bulletins,
    // résultats, récompenses, examens et décisions collectives sont effacés. Chef seulement.
    if (state.status === "preparation") throw new Problem("La compétition n’est pas démarrée.");
    if (p.confirm !== "REINITIALISER") throw new Problem("Confirmation requise : saisir REINITIALISER.");
    const effaces = state.rounds.length;
    Object.assign(state, {
      status: "preparation", rounds: [], active_round_id: null, rewards: [], exam_programs: [], exam_decisions: [],
      collective_decisions: [], discipline_progress: {}, alerts: [], rules_snapshot: null,
      public: { main: { kind: "idle" }, secondary: { kind: "idle" }, backstage: { kind: "idle" } },
      // Les brouillons de bulletins des téléphones deviennent caducs.
      restore_id: uid(),
    });
    return { rounds_effaces: effaces };
  }
  if (kind === "event.finish") {
    if (state.status !== "running" || currentDiscipline(state)) throw new Problem("Toutes les disciplines et récompenses doivent être terminées.");
    if (state.rounds.some((r: any) => r.grand_final && !CLOSED.has(r.status) && r.status !== "no_title")) throw new Problem("L’overall final doit être validé avant la clôture.");
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
    r.withdrawal_order = validateWithdrawal("withdrawal_order" in p ? p.withdrawal_order : r.withdrawal_order, panel, chiefOfPanel(panel, users));
    r.version += 1;
    return {};
  }
  if (kind === "round.open") {
    const r = find(state.rounds, p.round_id, "Tour");
    const force = p.force === true;
    if (force) requireRole(actor, ["chief", "responsable"]);
    openRound(state, r, users, now, force);
    if (force) r.forced_open = true;
    return { forced: force };
  }
  if (kind === "round.draw") {
    // Tirage manuel de l'ordre de passage : tour en attente (participants connus) ou ouvert sans
    // aucun bulletin ; ensuite l'ordre est figé, les juges ayant voté sur cet ordre d'appel.
    const r = find(state.rounds, p.round_id, "Tour");
    if (r.status !== "pending" && r.status !== "open") throw new Problem("Ce tour n’est plus en attente ni à l’appel.", 409);
    if (Object.keys(r.ballots).length) throw new Problem("Un bulletin a déjà été reçu : l’ordre de passage est figé.", 409);
    if (r.status === "pending") refreshParticipants(state, r);
    if (!r.participant_ids.length) throw new Problem("Les participants de ce tour ne sont pas encore connus.", 409);
    recordDraw(r, now, actor.id);
    r.version += 1;
    return { passage_order: [...r.passage_order] };
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
    calculate(state, r, users, p.qualified_ids ?? null, motif(p.reason ?? ""));
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
    (r.panel_changes ??= []).push({ remove_ids: remove, reason: motif(p.reason), at: now });
    r.status = "open";
    r.version += 1;
    tick(state, users, now);
    return {};
  }
  if (kind === "round.absent" || kind === "round.present") {
    // Décision PO du 24/09/2026 : « Un athlète absent est absent, il ne compte aucun point ! »
    // Avant le premier bulletin seulement : ensuite l'absence se traite par un incident.
    const r = find(state.rounds, p.round_id, "Tour");
    const entryId: string = p.entry_id;
    find(state.entries, entryId, "Inscription");
    if (r.status !== "pending" && r.status !== "open") throw new Problem("Ce tour n’est plus en attente ni à l’appel.", 409);
    if (Object.keys(r.ballots).length) throw new Problem("Un bulletin a déjà été reçu : traitez l’absence par un incident.", 409);
    r.absent_ids ??= [];
    r.absences ??= [];
    if (kind === "round.absent") {
      if (!strip(p.reason)) throw new Problem("Motif obligatoire.");
      if (r.absent_ids.includes(entryId)) throw new Problem("Déjà déclaré absent.", 422);
      if (!r.participant_ids.includes(entryId)) throw new Problem("Cette inscription ne participe pas à ce tour.");
      if (r.participant_ids.length <= 1) throw new Problem("Le dernier participant ne peut pas être déclaré absent : suspendez la manche par un incident.");
      r.participant_ids = r.participant_ids.filter((i: string) => i !== entryId);
      // L'absent sort de l'ordre de passage ; les autres gardent leur rang relatif.
      if (r.passage_order) r.passage_order = r.passage_order.filter((i: string) => i !== entryId);
      r.absent_ids.push(entryId);
      r.absences.push({ entry_id: entryId, reason: motif(p.reason), at: now, by: actor.id });
      shrinkQuota(r);
      r.version += 1;
      for (const x of dependents(state, r)) {
        x.absent_ids ??= [];
        if (!x.absent_ids.includes(entryId)) x.absent_ids.push(entryId);
        if (x.participant_ids.includes(entryId)) {
          x.participant_ids = x.participant_ids.filter((i: string) => i !== entryId);
          if (x.passage_order) x.passage_order = x.passage_order.filter((i: string) => i !== entryId);
          shrinkQuota(x);
          x.version += 1;
        }
      }
      return { absent_ids: [...r.absent_ids] };
    }
    const absence = r.absences.find((a: any) => a.entry_id === entryId && !a.restored) ?? null;
    if (!absence || !r.absent_ids.includes(entryId)) throw new Problem("Cette inscription n’a pas été déclarée absente sur ce tour.");
    absence.restored = { at: now, by: actor.id };
    r.absent_ids = r.absent_ids.filter((i: string) => i !== entryId);
    // Retour à la place d'origine : ordre de qualification du tour précédent, sinon ordre des inscriptions.
    const before = r.dependency_id ? find(state.rounds, r.dependency_id, "Tour précédent") : null;
    const base: string[] = before?.result?.qualified ?? state.entries.map((e: any) => e.id);
    const present = new Set<string>([...r.participant_ids, entryId]);
    r.participant_ids = [...base.filter((i) => present.has(i)), ...r.participant_ids.filter((i: string) => !base.includes(i))];
    // Retour dans l'ordre de passage en dernière position : les autres gardent leur numéro ;
    // le chef peut retirer l'ordre (round.draw) tant qu'aucun bulletin n'est reçu.
    if (r.passage_order && !r.passage_order.includes(entryId)) r.passage_order.push(entryId);
    restoreQuota(r);
    r.version += 1;
    for (const x of dependents(state, r)) {
      if (x.absent_ids?.includes(entryId)) {
        x.absent_ids = x.absent_ids.filter((i: string) => i !== entryId);
        x.version += 1;
      }
    }
    return { absent_ids: [...r.absent_ids] };
  }
  if (kind === "round.incident" || kind === "round.resolve") {
    const r = find(state.rounds, p.round_id, "Tour");
    if (!strip(p.reason)) throw new Problem("Motif obligatoire.");
    if (kind === "round.incident") {
      if (r.status === "suspended") throw new Problem("Ce tour est déjà suspendu.");
      r.previous_status = r.status;
      r.status = "suspended";
      (r.incidents ??= []).push({ reason: motif(p.reason), at: now, by: actor.id });
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
      const sections = new Set<string>(state.categories.filter((c: any) => c.discipline === d && categoryActive(c)).map((c: any) => c.section));
      if (!isSubset(sections, new Set<string>(progress.overall_sections ?? []))) throw new Problem("Constituez chaque overall avant de terminer ses récompenses.");
    }
    progress[stage + "_rewards_done"] = true;
    return {};
  }
  if (kind === "overall.create") {
    const d: string = p.discipline;
    const section: string = p.section;
    const progress = (state.discipline_progress[d] ??= {});
    if (d !== currentDiscipline(state)) throw new Problem("Cette discipline n’est pas en cours.");
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
  if (kind === "overall.final") {
    // Décision PO du 24/09/2026 : un overall par discipline et par sexe, pas de finale entre
    // disciplines. La commande est conservée mais désactivée : elle ne doit plus pouvoir bloquer une clôture.
    throw new Problem("Overall final toutes disciplines désactivé : un overall par discipline (décision du 24/09/2026).");
    // eslint-disable-next-line no-unreachable
    const section: string = p.section;
    if (state.status !== "running") throw new Problem("La compétition n’est pas en cours.");
    if (currentDiscipline(state) !== null) throw new Problem("Toutes les disciplines doivent être terminées avant l’overall final.");
    if (section !== "amateur" && section !== "pro") throw new Problem("Section invalide.");
    if (state.rounds.some((r: any) => r.grand_final && r.section === section)) throw new Problem("Overall final déjà constitué pour cette section.");
    const overalls = state.rounds.filter((r: any) => r.phase === "overall" && !r.grand_final && r.section === section);
    if (!overalls.length) throw new Problem("Aucun overall de discipline pour cette section.");
    if (overalls.some((r: any) => !CLOSED.has(r.status) && r.status !== "no_title")) throw new Problem("Tous les overalls de discipline doivent être validés.");
    const rows = overalls.flatMap((r: any) => (r.result ?? { official: [] }).official);
    let ids: string[] = overallCandidates(rows, state.entries, eligibleIds(state));
    const absent = new Set<string>(p.absent_ids ?? []);
    if (!isSubset(absent, new Set(ids))) throw new Problem("Absence overall inconnue.");
    ids = ids.filter((i) => !absent.has(i));
    const cat = { id: "overall-final-" + section, discipline: "overall", section };
    const r = makeRound(state, cat, "overall", ids);
    r.grand_final = true;
    r.absent_ids = [...absent];
    if (!ids.length) r.status = "no_title";
    state.rounds.push(r);
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

// Tours qui dépendent (directement ou en chaîne) d'un tour : demi-finale → finale.
export function dependents(state: any, r: any): any[] {
  const out: any[] = [];
  let ids = new Set<string>([r.id]);
  while (ids.size) {
    const next = state.rounds.filter((x: any) => ids.has(x.dependency_id) && !out.includes(x));
    out.push(...next);
    ids = new Set(next.map((x: any) => x.id));
  }
  return out;
}

// Même règle que `quotaValid` : le quota d'une demi-finale ou d'une éliminatoire ne dépasse jamais
// l'effectif. Un tour réduit par une absence garde son quota d'origine pour un éventuel rétablissement.
function shrinkQuota(r: any): void {
  if ((r.phase !== "semi" && r.phase !== "elimination") || !Number.isInteger(r.quota)) return;
  if (r.quota > r.participant_ids.length && r.participant_ids.length >= 1) {
    r.quota_before_absence ??= r.quota;
    r.quota = r.participant_ids.length;
  }
}

function restoreQuota(r: any): void {
  if (r.quota_before_absence == null) return;
  r.quota = Math.min(r.quota_before_absence, r.participant_ids.length);
  if (r.quota === r.quota_before_absence) delete r.quota_before_absence;
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
  // Overall créé automatiquement (26/09/2026) : tant qu'il n'est pas ouvert, la finale source reste
  // corrigeable et ses champions sont recalculés ; dès qu'il a été ouvert ou jugé, incident requis.
  if (r.phase === "final" && state.rounds.some((x: any) => x.phase === "overall" && x.discipline === r.discipline && x.section === r.section && (x.status !== "pending" || x.opened_at || Object.keys(x.ballots ?? {}).length))) {
    throw new Problem("L’overall est déjà constitué : traitement d’incident requis avant toute correction de sa finale source.", 409);
  }
}

/** Recalcule les champions d'un overall encore en attente après correction d'une finale source. */
function refreshPendingOverall(state: any, r: any): void {
  if (r.phase !== "final") return;
  const overall = state.rounds.find((x: any) => x.phase === "overall" && x.discipline === r.discipline && x.section === r.section && x.status === "pending" && !x.opened_at);
  if (!overall) return;
  const finals = state.rounds.filter((x: any) => x.discipline === r.discipline && x.section === r.section && x.phase === "final");
  if (finals.some((x: any) => !CLOSED.has(x.status))) return;
  const absent = new Set<string>(overall.absent_ids ?? []);
  overall.participant_ids = overallCandidates(finals.flatMap((x: any) => x.result.official), state.entries, eligibleIds(state)).filter((i) => !absent.has(i));
  overall.passage_order = null;
  overall.version += 1;
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
  refreshPendingOverall(state, r);
  // Les annonces antérieures sont retirées ; la régie publie la nouvelle version consciemment.
  for (const [screen, scene] of Object.entries<any>(state.public)) {
    if (scene.round_id === r.id) state.public[screen] = { kind: "idle", notice: "Résultat en cours de mise à jour" };
  }
}
