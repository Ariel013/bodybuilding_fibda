export type Entity = { id: string; [key: string]: any };
export type Round = Entity & {
  participant_ids: string[];
  panel: string[];
  trainees: string[];
  ballots: Record<string, any>;
  status: string;
  phase: string;
  category_id: string;
  /** Overall final toutes disciplines (décision PO du 23/09/2026) : catégorie hors `state.categories`. */
  grand_final?: boolean;
  section?: string;
};
export type State = {
  id: string;
  version: number;
  name: string;
  date: string;
  location: string;
  mode: string;
  status: string;
  demo: boolean;
  restore_id: string;
  server_time: number | string;
  me: Entity;
  people: Entity[];
  entries: Entity[];
  categories: Entity[];
  officials: Entity[];
  users: Entity[];
  rounds: Round[];
  rewards: Entity[];
  alerts: any[];
  exam_programs: any[];
  settings: Record<string, any>;
  active_round_id: string | null;
  public: Record<string, any>;
  [key: string]: any;
};
export type Command = (
  type: string,
  payload?: Record<string, any>,
) => Promise<any>;
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
export const personName = (p?: Entity) =>
  p
    ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.name || p.id
    : "Personne inconnue";
export const labels: Record<string, string> = {
  chief: "Chef de jury",
  responsable: "Responsable",
  director: "Directeur",
  judge: "Juge",
  trainee: "Stagiaire",
  secretariat: "Secrétariat",
  regie: "Régie",
  speaker: "Speaker",
  commission: "Commission",
  preparation: "Préparation",
  running: "En cours",
  finished: "Terminée",
  pending: "À venir",
  open: "Ouvert",
  awaiting_validation: "À valider",
  validated: "Validé",
  published: "Publié",
  suspended: "Suspendu",
  elimination: "Éliminatoires",
  semi: "Demi-finale",
  final: "Finale",
  overall: "Toutes catégories",
  amateur: "Amateur",
  pro: "Professionnel",
};
