import { createHash } from "node:crypto";
import { ADMIN, intersects } from "./auth";
import { Problem } from "./problem";
import { deepcopy, dump, uid } from "./util";
import type { User } from "./state";
import { collectiveResults, examReport } from "../domain/domain";
import { eligibleIds } from "./workflow";

// Projections : ce que chaque rôle, et l'écran public, ont le droit de voir. Copie de projections.py.

const pick = (o: any, keys: string[]) => Object.fromEntries(keys.map((k) => [k, o?.[k] ?? null]));

export function publicPerson(p: any): any {
  const out = pick(p, ["id", "first_name", "last_name", "country", "club", "pronunciation", "section"]);
  if (p.photo_approved && p.photo_consent) {
    const approved: string[] = p.approved_photo_ids ?? [];
    for (const k of ["photo_portrait", "photo_full"]) if (p[k] && approved.includes(p[k])) out[k] = p[k];
    out.photo_approved = true;
    out.photo_consent = true;
  }
  return out;
}

export function publicOfficial(o: any): any {
  const out = pick(o, ["id", "first_name", "last_name", "post", "organization", "country", "pedigree"]);
  if (o.photo_approved && o.photo_consent && (o.approved_photo_ids ?? []).includes(o.photo_id)) out.photo_id = o.photo_id;
  return out;
}

// Écran public : projection filtrée, jamais l'agrégat privé, résultats uniquement validés ou publiés.
export function publicState(state: any, screen: string): any {
  if (!["main", "secondary", "backstage"].includes(screen)) throw new Problem("Affichage inconnu.", 404);
  const scene = deepcopy(state.public[screen]);
  const r = state.rounds.find((x: any) => x.id === scene.round_id) ?? null;
  const ids = new Set<string>(r ? r.participant_ids : []);
  if (scene.category_id && !r) for (const e of state.entries) if (e.category_id === scene.category_id && e.confirmed) ids.add(e.id);
  const entries = state.entries.filter((e: any) => ids.has(e.id)).map((e: any) => pick(e, ["id", "person_id", "category_id", "bib"]));
  const personIds = new Set(entries.map((e: any) => e.person_id));
  const officialIds = new Set<string>([...(scene.official_ids ?? []), scene.official_id]);
  const rounds: any[] = [];
  if (r) {
    const pr: any = Object.fromEntries(["id", "category_id", "discipline", "section", "phase", "participant_ids"].map((k) => [k, deepcopy(r[k] ?? null)]));
    if (["qualifiers", "reveal", "podium", "ranking"].includes(scene.kind) && r.result && ["validated", "published"].includes(r.status)) {
      let rows: any[] = r.result.official;
      const kind = scene.kind;
      if (kind === "reveal") rows = [...rows].sort((a, b) => b.rank - a.rank).slice(0, scene.revealed_count ?? 0);
      if (kind === "podium") rows = rows.filter((x) => x.rank <= 3);
      pr.result = {
        official: kind !== "qualifiers" ? rows.map((x) => pick(x, ["entry_id", "rank"])) : [],
        qualified: kind === "qualifiers" ? r.result.qualified : [],
        version: r.result.version,
      };
    }
    rounds.push(pr);
  }
  return {
    name: state.name,
    mode: state.mode,
    demo: state.demo,
    version: state.version,
    scene,
    people: state.people.filter((p: any) => personIds.has(p.id)).map(publicPerson),
    entries,
    officials: state.officials.filter((o: any) => officialIds.has(o.id)).map(publicOfficial),
    categories: state.categories.filter((c: any) => c.id === scene.category_id || (r && c.id === r.category_id)).map((c: any) => pick(c, ["id", "name", "discipline", "section"])),
    rounds,
  };
}

// État privé filtré par rôle : bulletins des autres, données sensibles et résultats non partagés retirés.
export function projectState(state: any, actor: User, users: User[], now: number): any {
  const out = deepcopy(state);
  const roles = new Set(actor.roles);
  out.me = actor;
  out.server_time = now;
  out.users = users;
  if (!intersects(roles, ADMIN)) {
    out.users = users.filter((u) => u.id === actor.id);
    delete out.settings.collective_tiebreak;
    for (const p of out.people) {
      if (!roles.has("secretariat")) for (const k of ["private_contact", "birth_date", "nationalities", "licence_ok", "payment_ok", "minor_authorization"]) delete p[k];
    }
    for (const r of out.rounds) {
      delete r.history;
      delete r.removed_ballots;
      delete r.correction;
      r.ballots = Object.fromEntries(Object.entries(r.ballots).filter(([j]) => j === actor.id));
      // Le résultat sportif n'est partagé qu'avec la conduite / régie et après validation.
      if (!intersects(roles, ["regie", "speaker", "commission"])) r.result = null;
      else if (r.result) {
        delete r.result.reference_ranking;
        delete r.result.reference_version;
        for (const rows of [r.result.common ?? [], r.result.official ?? []]) {
          if (Array.isArray(rows)) for (const row of rows) if (row && typeof row === "object") for (const key of ["ranks", "removed_min", "removed_max"]) delete row[key];
        }
      }
    }
    if (!roles.has("commission")) {
      out.exam_programs = out.exam_programs.filter((p: any) => p.user_id === actor.id);
      out.exam_decisions = out.exam_decisions.filter((p: any) => p.user_id === actor.id);
    }
    if (!intersects(roles, ["regie", "speaker", "secretariat"])) out.rewards = [];
  }
  out.alerts = out.alerts.filter((a: any) => intersects(roles, a.roles ?? []));
  delete out.rules_snapshot;
  return out;
}

export function exams(state: any, actor: User): any {
  const allowed = intersects(actor.roles, [...ADMIN, "commission"]);
  return {
    reports: state.exam_programs.filter((p: any) => allowed || p.user_id === actor.id).map((p: any) => ({ user_id: p.user_id, ...examReport(p, state.rounds, p.user_id) })),
    decisions: state.exam_decisions.filter((d: any) => allowed || d.user_id === actor.id),
  };
}

export function collective(state: any): any {
  // Décision FIBDA du 24/09/2026 (voir domain.ts collectiveResults et OPEN-QUESTIONS P11) :
  // comptent les finales validées/publiées, les overalls de discipline validés/publiés (dont un
  // champion seul confirmé, rang 1) et, à 1 point, chaque inscription confirmée d'une catégorie
  // déjà engagée (au moins un tour validé) absente de tout résultat officiel de finale.
  // L'overall final toutes disciplines (`grand_final`) n'est pas compté : non tranché par le PO.
  const closed = (r: any) => ["validated", "published"].includes(r.status);
  const finals = state.rounds.filter((r: any) => r.phase === "final");
  const overalls = state.rounds.filter((r: any) => r.phase === "overall" && !r.grand_final);
  const officialRows = (r: any) => ((r.result ?? {}).official ?? []).map((x: any) => ({ ...x, round_id: r.id, phase: r.phase, section: r.section }));
  const rows = [...finals.filter(closed).flatMap(officialRows), ...overalls.filter(closed).flatMap(officialRows)];
  const rankedByCategory = new Map<string, Set<string>>();
  for (const r of finals.filter(closed)) {
    const set = rankedByCategory.get(r.category_id) ?? new Set<string>();
    for (const x of (r.result ?? {}).official ?? []) set.add(x.entry_id);
    rankedByCategory.set(r.category_id, set);
  }
  const engaged = new Set<string>(state.rounds.filter((r: any) => r.phase !== "overall" && closed(r)).map((r: any) => r.category_id));
  for (const e of state.entries) {
    if (!e.confirmed || !engaged.has(e.category_id) || rankedByCategory.get(e.category_id)?.has(e.id)) continue;
    rows.push({ entry_id: e.id, rank: 99, participation: true, round_id: null, phase: "final", category_id: e.category_id });
  }
  const complete = finals.length > 0 && finals.every(closed);
  // Empreinte des versions de résultats : finales puis overalls, dans l'ordre de l'état.
  const revision = createHash("sha256")
    .update(JSON.stringify([...finals, ...overalls].map((r: any) => [r.id, (r.result ?? {}).version ?? null])).replace(/,/g, ", "))
    .digest("hex");
  const eligible = eligibleIds(state);
  const out: any = {
    club: collectiveResults(rows, state.entries, state.people, "club", eligible, "counts"),
    country: state.mode === "international" ? collectiveResults(rows, state.entries, state.people, "country", eligible, "counts") : [],
    decisions: state.collective_decisions,
    complete,
    revision,
    winners: {},
  };
  if (complete) {
    for (const kind of ["club", "country"]) {
      const tied = out[kind].filter((x: any) => x.rank === 1).map((x: any) => x.name);
      if (tied.length === 1) out.winners[kind] = tied[0];
      else if (tied.length > 1) {
        const decisions = state.collective_decisions.filter((d: any) => d.kind === kind && d.revision === revision);
        const rev = [...decisions].reverse();
        const chief = rev.find((d: any) => d.roles.includes("chief")) ?? null;
        const director = rev.find((d: any) => d.roles.includes("director")) ?? null;
        if (chief && director && chief.by !== director.by) {
          if (chief.winner === director.winner) out.winners[kind] = chief.winner;
          else {
            const arbiter = rev.find((d: any) => d.roles.includes("responsable") && ![chief.by, director.by].includes(d.by) && dump(d.arbitrates ?? null) === dump([chief.id, director.id]));
            if (arbiter) out.winners[kind] = arbiter.winner;
          }
        }
      }
    }
  }
  return out;
}

export function syncCollectiveRewards(state: any): void {
  const results = collective(state);
  const previous: Record<string, any> = Object.fromEntries(state.rewards.filter((r: any) => ["club", "country"].includes(r.kind)).map((r: any) => [r.kind, r]));
  state.rewards = state.rewards.filter((r: any) => !["club", "country"].includes(r.kind));
  for (const [kind, winner] of Object.entries(results.winners as Record<string, string>)) {
    const reward: any = { id: uid(), round_id: null, category_id: null, entry_id: null, rank: 1, kind, collective_name: winner, title: kind === "club" ? "Meilleur club" : "Meilleur pays", prepared: false, delivered: false, trophy: "", medal: "", lot: "", prize: "", currency: "XOF", result_version: results.revision };
    const old = previous[kind];
    if (old && old.collective_name === winner) for (const k of ["id", "title", "prepared", "delivered", "trophy", "medal", "lot", "prize", "currency"]) if (k in old) reward[k] = old[k];
    state.rewards.push(reward);
  }
}
