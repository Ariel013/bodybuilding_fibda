import { randomBytes } from "node:crypto";
import type { Store, Conn } from "./store";
import { uid } from "./util";
import { loadCatalogue } from "../domain/catalogue";

// Données fictives de démonstration : copie de demo.py. Les codes générés ne peuplent jamais un événement officiel.
export async function seedDemo(store: Store, conn: Conn, state: any): Promise<Record<string, { name: string; roles: string[]; code: string }>> {
  if (!store.demo || !state.demo) throw new Error("Les données fictives sont réservées au mode démonstration");
  if (state.demo_seeded) return {};
  if (state.people.length || state.rounds.length || state.categories.length) throw new Error("Le peuplement démo exige un événement vide");
  const codes: Record<string, { name: string; roles: string[]; code: string }> = {};
  const existing = await store.allUsers(conn);
  let chief = existing.find((u) => u.roles.includes("chief")) ?? null;
  const account = async (name: string, roles: string[]) => {
    const code = randomBytes(12).toString("base64url");
    const user = await store.addUser(conn, name, roles, code, true);
    codes[user.id] = { name, roles, code };
    return user;
  };
  if (!chief) chief = await account("Chef démonstration", ["chief"]);
  const judges = [];
  for (let i = 1; i <= 4; i++) judges.push(await account(`Juge fictif ${i}`, ["judge"]));
  const trainee = await account("Stagiaire démonstration", ["trainee"]);
  await account("Direction démonstration", ["director"]);
  await account("Régie démonstration", ["regie"]);
  await account("Secrétariat démonstration", ["secretariat"]);
  const catalogue = loadCatalogue();
  const rules: Record<string, any> = Object.fromEntries(catalogue.rules.map((r: any) => [r.id, r]));
  const specifications: [string, string][] = [["mens_physique-senior-all-170", "169.0"], ["mens_physique-senior-all-173", "172.0"], ["bikini-senior-all-164", "163.0"]];
  specifications.forEach(([ruleId, height], order) => {
    const rule = rules[ruleId];
    const category: any = { id: uid(), name: rule.name, discipline: rule.discipline, sex: rule.sex, section: "amateur", division: "senior", age_min: null, age_max: null, rule_id: ruleId, order, entry_ids: [], quota: 6, elimination_quota: 15, phase_override: null, merged_from: [], archived: false };
    state.categories.push(category);
    for (let i = 0; i < 8; i++) {
      const number = order * 8 + i + 1;
      const person = { id: uid(), first_name: `Athlète ${String(number).padStart(2, "0")}`, last_name: "FICTIF", birth_date: "1995-06-15", sex: rule.sex, nationalities: i !== 7 ? ["CI"] : ["FR"], country: i !== 7 ? "CI" : "FR", club: `Club fictif ${(i % 3) + 1}`, section: "amateur", status_approved: true, delegation_approved: true, organizer_approved: true, licence_ok: true, payment_ok: true, minor_authorization: false, height_cm: height, weight_kg: rule.sex === "F" ? "65.0" : "75.0", measurements_confirmed: true, photo_portrait: null, photo_full: null, photo_approved: false, photo_consent: false, private_contact: "", pronunciation: "" };
      const entry = { id: uid(), person_id: person.id, category_id: category.id, bib: number, confirmed: true, derogation: null, origin_category_id: category.id };
      state.people.push(person);
      state.entries.push(entry);
      category.entry_ids.push(entry.id);
    }
  });
  Object.assign(state, { name: "Démonstration FIBDA - données fictives", date: "2026-09-23", location: "Formation", bibs_distributed: true, demo_seeded: true });
  state.jury = { panel: [chief.id, ...judges.map((j) => j.id)], trainees: [trainee.id], withdrawal_order: [...judges].reverse().map((j) => j.id) };
  Object.assign(state.settings, { regulations_checked: true, network_checked: true, backup_checked: true });
  state.rules_snapshot = catalogue;
  const before = state.version;
  state.version += 1;
  await store.write(conn, state, before);
  await store.record(conn, state, chief.id, "demo.seed", { athletes: 24, notice: "Données et contrôles fictifs uniquement" });
  return codes;
}
