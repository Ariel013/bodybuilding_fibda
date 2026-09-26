import { DomainError, fraction, fractionAdd, fractionDiv, fractionJson, pairConcordance, type Fraction, type FractionJson } from "../domain/domain";
import type { User } from "./state";

// Concordance des juges avec le bulletin du chef (demande du PO du 26/09/2026).
//
// Même formule que l'examen des stagiaires (`examReport` / `pairConcordance` dans
// ../domain/domain.ts) : pourcentage des paires d'athlètes ordonnées dans le même sens que la
// référence, moyenne non pondérée par manche. Comme l'examen :
//  - le bulletin comparé est le bulletin **original** du juge (avant toute correction papier) ;
//  - une manche validée ou publiée est comparée à la référence chef **gelée** à la validation
//    (`result.reference_ranking`, versionnée) ;
//  - les éliminatoires (bulletin de sélection, pas de classement) ne sont pas comparables : ignorées.
// Différence assumée avec l'examen : tant que la manche n'est pas validée, la référence est le
// bulletin courant du chef, pour que le chef voie les pourcentages dès la réception des bulletins.
// Aucun pourcentage n'est inventé : sans bulletin du chef la manche est absente, sans bulletin du
// juge son score est `null`.

export interface ConcordanceJudge {
  user_id: string;
  trainee: boolean;
  /** Pourcentage de paires concordantes ; `null` si aucun bulletin comparable. */
  score: FractionJson | null;
  pairs: number;
  /** Faux si le bulletin manque ou ne porte pas sur les mêmes athlètes que la référence. */
  comparable: boolean;
}

export interface ConcordanceRound {
  round_id: string;
  category_id: string | null;
  phase: string;
  status: string;
  /** `validated` : référence gelée à la validation ; `ballot` : bulletin courant du chef. */
  reference_source: "validated" | "ballot";
  reference_version: unknown;
  judges: ConcordanceJudge[];
}

export interface ConcordanceSummary {
  user_id: string;
  trainee: boolean;
  /** Moyenne non pondérée des scores par manche ; `null` sans manche comparée. */
  mean: FractionJson | null;
  rounds: number;
  pairs: number;
}

export interface ConcordanceReport {
  chief_id: string | null;
  rounds: ConcordanceRound[];
  judges: ConcordanceSummary[];
}

const truthy = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== "" && v !== false);

/** Classement retenu pour un bulletin : l'original s'il existe (comme `examReport`). */
function originalRanking(ballot: any): string[] | null {
  if (!truthy(ballot)) return null;
  const original = truthy(ballot.original) ? ballot.original : ballot;
  return truthy(original.ranking) ? (original.ranking as string[]) : null;
}

/** Référence chef d'une manche : gelée si validée/publiée, sinon le bulletin courant du chef. */
function reference(r: any, chief: string): { ranking: string[]; source: "validated" | "ballot"; version: unknown } | null {
  if (["validated", "published"].includes(r.status) && truthy(r.result?.reference_ranking)) {
    return { ranking: r.result.reference_ranking, source: "validated", version: r.result.reference_version ?? null };
  }
  const ballot = (r.ballots ?? {})[chief];
  if (!ballot || !truthy(ballot.ranking)) return null;
  return { ranking: ballot.ranking, source: "ballot", version: ballot.version ?? null };
}

/** Score d'un bulletin ; `null` s'il ne porte pas sur les mêmes athlètes que la référence (non comparable). */
function compare(ranking: string[], ref: string[]): [Fraction, number] | null {
  try {
    return pairConcordance(ranking, ref);
  } catch (e) {
    if (e instanceof DomainError) return null;
    throw e;
  }
}

export function concordanceReport(state: any, users: User[]): ConcordanceReport {
  // Plusieurs chefs possibles (PO, 26/09/2026) : la référence d'une manche est le chef présent dans son panel.
  const chiefs = users.filter((u) => u.roles.includes("chief") && u.active).map((u) => u.id);
  if (chiefs.length === 0) return { chief_id: null, rounds: [], judges: [] };
  const rounds: ConcordanceRound[] = [];
  const perJudge = new Map<string, { trainee: boolean; scores: Fraction[]; pairs: number }>();
  for (const r of state.rounds ?? []) {
    if (r.phase === "elimination") continue;
    const inPanel = (r.panel ?? []).filter((id: string) => chiefs.includes(id));
    if (inPanel.length !== 1) continue;
    const chief: string = inPanel[0];
    const ref = reference(r, chief);
    if (!ref || ref.ranking.length < 2) continue;
    const judges: ConcordanceJudge[] = [];
    const members: string[] = [...(r.panel ?? []), ...(r.trainees ?? [])].filter((id, i, all) => id !== chief && all.indexOf(id) === i);
    for (const id of members) {
      const trainee = (r.trainees ?? []).includes(id);
      const ranking = originalRanking((r.ballots ?? {})[id]);
      const compared = ranking ? compare(ranking, ref.ranking) : null;
      judges.push({ user_id: id, trainee, score: compared ? fractionJson(compared[0]) : null, pairs: compared ? compared[1] : 0, comparable: compared !== null });
      const acc = perJudge.get(id) ?? { trainee, scores: [] as Fraction[], pairs: 0 };
      acc.trainee = acc.trainee || trainee;
      if (compared) {
        acc.scores.push(compared[0]);
        acc.pairs += compared[1];
      }
      perJudge.set(id, acc);
    }
    rounds.push({ round_id: r.id, category_id: r.category_id ?? null, phase: r.phase, status: r.status, reference_source: ref.source, reference_version: ref.version, judges });
  }
  const judges: ConcordanceSummary[] = [];
  for (const u of users) {
    const acc = perJudge.get(u.id);
    if (!acc) continue;
    const mean = acc.scores.length ? fractionDiv(acc.scores.reduce(fractionAdd, fraction(0n)), fraction(acc.scores.length)) : null;
    judges.push({ user_id: u.id, trainee: acc.trainee, mean: mean ? fractionJson(mean) : null, rounds: acc.scores.length, pairs: acc.pairs });
  }
  return { chief_id: chiefs.length === 1 ? chiefs[0] : null, rounds, judges };
}
