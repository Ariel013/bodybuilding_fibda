import { ADMIN, REGIE, SPORT, require, intersects, union } from "./auth";
import { Problem } from "./problem";
import { find, uid } from "./util";
import type { Store, Conn } from "./store";
import { newState, type User } from "./state";
import { applyPreparation } from "./preparation";
import { applySport, applyCorrection, motif } from "./workflow";
import { exams, collective } from "./projections";

// Dispatch des commandes : copie de commands.py. Chaque commande vérifie ses droits côté serveur.
const PREP = new Set(["event.update", "person.save", "person.delete", "entry.save", "entry.remove", "measurement.save", "category.save", "category.activate", "category.fuse", "programme.reorder", "bibs.assign", "entry.late", "official.save"]);
// Commandes qui écrivent ailleurs que dans l'état (comptes, sessions, photos, aperçus) : elles
// s'exécutent dans une transaction explicite. Toutes les autres ne touchent que l'état et passent
// par l'écriture optimiste en un seul lot (app.ts, route /api/v1/command).
export const TRANSACTIONAL = new Set(["person.delete", "event.purge", "user.invite", "user.approve", "user.deactivate"]);
const SPORTS = new Set(["jury.configure", "programme.generate", "event.start", "event.finish", "event.reset", "round.configure", "round.open", "round.next", "round.validate", "round.correct", "round.incident", "round.resolve", "round.absent", "round.present", "round.draw", "panel.reduce", "overall.create", "overall.final", "overall.confirm", "discipline.advance", "ballot.submit", "paper.submit", "rewards.complete"]);

// `users` : comptes déjà lus par l'appelant dans le même instantané que l'état (un aller-retour de
// moins) ; à défaut, ils sont lus ici.
export async function applyCommand(store: Store, conn: Conn, state: any, actor: User, kind: string, p: any, users?: User[]): Promise<any> {
  users ??= await store.allUsers(conn);
  const now = store.clock();
  if (kind === "person.delete") {
    const result = applyPreparation(state, actor, kind, p);
    const ids: string[] = result.person_ids;
    await conn.execute({ sql: `DELETE FROM photos WHERE owner_type = 'person' AND owner_id IN (${ids.map(() => "?").join(", ")})`, args: ids });
    return result;
  }
  if (kind === "event.purge") {
    // Vidage (PO, 26/09/2026) : repartir d'une compétition vide sans toucher aux comptes. Chef seulement,
    // confirmation saisie. Conservés : comptes, identité de l'événement (nom, date, lieu, mode, liste de
    // contrôle). Effacés : athlètes, inscriptions, catégories, officiels, jury, manches, résultats,
    // récompenses, examens, photos et logos. Les brouillons des téléphones deviennent caducs.
    require(actor, ["chief"]);
    if (p.confirm !== "VIDER") throw new Problem("Confirmation requise : saisir VIDER.");
    const bilan = { athletes_effaces: state.people.length, categories_effacees: state.categories.length, manches_effacees: state.rounds.length };
    const kept = new Set(["id", "version", "name", "date", "location", "mode", "settings", "demo"]);
    const fresh = newState(Boolean(state.demo));
    for (const key of Object.keys(state)) if (!kept.has(key) && !(key in fresh)) delete state[key];
    for (const [key, value] of Object.entries(fresh)) if (!kept.has(key)) state[key] = value;
    await conn.execute("DELETE FROM photos");
    await conn.execute("DELETE FROM import_previews");
    // Le cache d'idempotence garde les résultats des commandes (fiches complètes) : effacé aussi, sinon
    // l'effacement annoncé ne serait pas total. Sans effet sur l'idempotence : la version change.
    await conn.execute("DELETE FROM commands");
    return bilan;
  }
  if (PREP.has(kind)) return applyPreparation(state, actor, kind, p);
  if (SPORTS.has(kind)) return applySport(state, actor, kind, p, users, now);
  if (kind === "user.invite") {
    require(actor, ADMIN);
    const roles: string[] = p.roles ?? [];
    if (intersects(roles, ["chief", "responsable", "director"]) && !actor.roles.includes("chief")) throw new Problem("Seul le chef peut créer un accès de direction.", 403);
    const approved = actor.roles.includes("chief") || !intersects(roles, ["judge", "trainee", "responsable"]);
    const user = await store.addUser(conn, p.name ?? "", roles, p.code ?? "", approved);
    return { user };
  }
  if (kind === "user.approve") {
    require(actor, ["chief"]);
    const user = find(users, p.user_id, "Utilisateur");
    await conn.execute({ sql: "UPDATE users SET approved = 1 WHERE id = ?", args: [user.id] });
    return {};
  }
  if (kind === "user.deactivate") {
    // Révocation d'accès (téléphone perdu, juge remplacé) : compte désactivé et sessions supprimées.
    require(actor, ["chief"]);
    const user = find(users, p.user_id, "Utilisateur");
    if (user.id === actor.id) throw new Problem("Le chef ne peut pas se désactiver lui-même.");
    await conn.execute({ sql: "UPDATE users SET active = 0 WHERE id = ?", args: [user.id] });
    await conn.execute({ sql: "DELETE FROM sessions WHERE user_id = ?", args: [user.id] });
    return {};
  }
  if (kind === "correction.sign") {
    require(actor, ["chief", "director"]);
    const r = find(state.rounds, p.round_id, "Tour");
    const c = r.correction;
    if (!c || !c.published) throw new Problem("Aucune correction publiée à signer.");
    if (!c.signatures.includes(actor.id)) c.signatures.push(actor.id);
    const signed = users.filter((u) => c.signatures.includes(u.id));
    const chiefs = new Set(signed.filter((u) => u.roles.includes("chief")).map((u) => u.id));
    const directors = new Set(signed.filter((u) => u.roles.includes("director")).map((u) => u.id));
    const disjoint = [...chiefs].every((id) => !directors.has(id));
    if (chiefs.size && directors.size && disjoint) applyCorrection(state, r, users, now);
    return { pending_signatures: Boolean(r.correction) };
  }
  if (kind === "scene.set") {
    require(actor, REGIE);
    const screen = p.screen;
    let scene: any = p.scene ?? {};
    const kindscene = scene.kind;
    if (!(screen in state.public) || !["idle", "category", "qualifiers", "reveal", "podium", "ranking", "official", "officials"].includes(kindscene)) throw new Problem("Scène inconnue.");
    const allowed = ["kind", "category_id", "round_id", "official_id", "official_ids", "called_entry_id", "revealed_count", "positions"];
    scene = Object.fromEntries(Object.entries(scene).filter(([k]) => allowed.includes(k)));
    if (scene.category_id) find(state.categories, scene.category_id, "Catégorie");
    const r = scene.round_id ? find(state.rounds, scene.round_id, "Tour") : null;
    if (r && scene.category_id && scene.category_id !== r.category_id) throw new Problem("La catégorie et le tour ne correspondent pas.");
    if (["qualifiers", "reveal", "podium", "ranking"].includes(kindscene)) {
      if (!r || !["validated", "published"].includes(r.status) || !r.result) throw new Problem("Résultat non validé : diffusion interdite.");
      if (kindscene === "qualifiers" && !["semi", "elimination"].includes(r.phase)) throw new Problem("Pas de qualification pour ce tour.");
      if (["reveal", "podium", "ranking"].includes(kindscene) && !["final", "overall"].includes(r.phase)) throw new Problem("Révélation réservée aux finales et overall.");
      const prior = state.public[screen];
      const n = r.result.official.length;
      if (kindscene === "reveal") {
        const count = scene.revealed_count ?? 0;
        if (!Number.isInteger(count) || count < 0 || count > n) throw new Problem("Nombre d’annonces invalide.");
        const old = prior.round_id === r.id ? (prior.revealed_count ?? 0) : 0;
        if (count > old + 1) throw new Problem("Annoncez les athlètes un par un du dernier au premier.");
        r.reveals = r.reveals ?? {};
        r.reveals[screen] = Math.max(r.reveals[screen] ?? 0, count);
      }
      if (["podium", "ranking"].includes(kindscene) && ((r.reveals ?? {})[screen] ?? 0) < n) throw new Problem("Terminez les annonces avant le podium et le classement complet.");
      r.status = "published";
      r.has_been_published = true;
    }
    for (const ident of scene.official_id ? [scene.official_id] : (scene.official_ids ?? [])) find(state.officials, ident, "Officiel");
    if (scene.called_entry_id) {
      const e = find(state.entries, scene.called_entry_id, "Athlète");
      if (r && !r.participant_ids.includes(e.id)) throw new Problem("Cet athlète ne participe pas au tour.");
    }
    scene.version = state.version + 1;
    state.public[screen] = scene;
    return {};
  }
  if (kind === "reward.update") {
    require(actor, union(ADMIN, ["secretariat"]));
    const reward = find(state.rewards, p.reward_id, "Récompense");
    for (const key of ["prepared", "delivered", "title", "trophy", "medal", "lot", "prize", "currency"]) if (key in p) reward[key] = p[key];
    return {};
  }
  if (kind === "exam.program") {
    require(actor, union(SPORT, ["commission"]));
    const u = find(users, p.user_id, "Juge");
    const ids: string[] = p.round_ids ?? [];
    if (!intersects(u.roles, ["trainee", "judge", "responsable"])) throw new Problem("Cet utilisateur n’est pas candidat à la comparaison.");
    if (ids.length !== new Set(ids).size) throw new Problem("Un tour ne compte qu’une fois.");
    const old = state.exam_programs.find((x: any) => x.user_id === u.id) ?? null;
    const locked = old && old.round_ids.some((i: string) => find(state.rounds, i).status !== "pending");
    if (locked && !old.round_ids.every((i: string) => ids.includes(i))) throw new Problem("Le programme engagé ne peut être réduit ou remplacé.");
    for (const ident of ids) {
      if (locked && old.round_ids.includes(ident)) continue;
      const r = find(state.rounds, ident, "Tour");
      if (r.status !== "pending" || r.phase === "elimination") throw new Problem("Programmez les tours classés avant leur ouverture.");
      if (![...r.panel, ...r.trainees].includes(u.id)) throw new Problem("Le juge doit être attendu sur chaque tour.");
    }
    state.exam_programs = [...state.exam_programs.filter((x: any) => x.user_id !== u.id), { user_id: u.id, round_ids: ids, version: ((old ?? {}).version ?? 0) + 1 }];
    return {};
  }
  if (kind === "exam.decide") {
    require(actor, ["commission"]);
    const report = exams(state, actor).reports.find((x: any) => x.user_id === p.user_id) ?? null;
    if (!report) throw new Problem("Programme d’examen absent.");
    if (!["approved", "rejected", "deferred"].includes(p.decision) || !String(p.reason ?? "").trim()) throw new Problem("Décision et motif requis.");
    if (p.decision === "approved" && !report.passed) throw new Problem("Les conditions de réussite ne sont pas atteintes.");
    state.exam_decisions.push({ id: uid(), ...p, reason: motif(p.reason), by: actor.id, at: now, report });
    return {};
  }
  if (kind === "collective.decide") {
    require(actor, ADMIN);
    const k = p.kind;
    const result = collective(state);
    const rows: any[] = ["club", "country"].includes(k) ? (result[k] ?? []) : [];
    if (!result.complete) throw new Problem("Toutes les finales doivent être validées avant le départage collectif.");
    if (!rows.length || !rows.filter((r) => r.rank === 1).map((r) => r.name).includes(p.winner)) throw new Problem("Le vainqueur doit appartenir au groupe ex æquo en tête.");
    if (!String(p.reason ?? "").trim() || !state.settings.collective_tiebreak) throw new Problem("Critère publié et motif requis.");
    const decisions = state.collective_decisions.filter((d: any) => d.kind === k && d.revision === result.revision);
    const rev = [...decisions].reverse();
    const chief = rev.find((d: any) => d.roles.includes("chief")) ?? null;
    const director = rev.find((d: any) => d.roles.includes("director")) ?? null;
    let arbitration: string[] = [];
    if (!intersects(actor.roles, ["chief", "director"])) {
      if (!chief || !director || chief.winner === director.winner || [chief.by, director.by].includes(actor.id)) throw new Problem("Le responsable arbitre uniquement un désaccord préalable entre le chef et le directeur.");
      arbitration = [chief.id, director.id];
    }
    state.collective_decisions.push({ id: uid(), kind: k, winner: p.winner, reason: motif(p.reason), by: actor.id, roles: actor.roles, at: now, criterion: state.settings.collective_tiebreak, revision: result.revision, arbitrates: arbitration });
    return {};
  }
  throw new Problem("Commande inconnue.", 404);
}
