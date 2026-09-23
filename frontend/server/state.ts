import { uid } from "./util";

// État initial d'un événement : copie exacte de `store.new_state` (Python).
// Toute clé ajoutée ici doit l'être aussi dans docs/CONTRACT.md.
export function newState(demo = false): any {
  return {
    id: uid(),
    version: 0,
    name: "Nouvelle compétition FIBDA",
    date: "2027-01-01",
    location: "",
    mode: "national",
    status: "preparation",
    demo,
    rules_version: "FIBDA-2026-09-22",
    restore_id: uid(),
    bibs_distributed: false,
    people: [],
    entries: [],
    categories: [],
    officials: [],
    rounds: [],
    active_round_id: null,
    public: { main: { kind: "idle" }, secondary: { kind: "idle" }, backstage: { kind: "idle" } },
    alerts: [],
    rewards: [],
    exam_programs: [],
    exam_decisions: [],
    collective_decisions: [],
    discipline_progress: {},
    jury: { panel: [], trainees: [], withdrawal_order: [] },
    settings: { collective_tiebreak: "", regulations_checked: false, network_checked: false, backup_checked: false },
    rules_snapshot: null,
  };
}

export type User = { id: string; name: string; roles: string[]; approved: boolean; active: boolean };
