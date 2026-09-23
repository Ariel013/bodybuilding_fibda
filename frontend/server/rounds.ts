import { uid } from "./util";

// Un tour neuf, en attente, avec le jury courant et les compteurs à zéro (workflow.make_round).
// Module séparé pour être partagé par workflow.ts et preparation.ts sans import circulaire.
export function makeRound(state: any, cat: any, phase: string, participants: Iterable<string>, quota: number | null = null, dependency: string | null = null): any {
  const jury = state.jury;
  return {
    id: uid(),
    category_id: cat.id,
    discipline: cat.discipline,
    section: cat.section,
    phase,
    status: "pending",
    participant_ids: [...participants],
    panel: [...jury.panel],
    trainees: [...jury.trainees],
    withdrawal_order: [...jury.withdrawal_order],
    quota,
    ballots: {},
    trainee_deadline: null,
    expired_trainees: [],
    transitioned: false,
    result: null,
    correction: null,
    dependency_id: dependency,
    opened_at: null,
    version: 1,
  };
}
