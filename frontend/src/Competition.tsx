import { overallExamCandidates, selectedOverallExams } from "./exam";
import { canCommand } from "./permissions";
import { useEffect, useState } from "react";
import { api } from "./api";
import { type State, type Command, type Round, labels } from "./types";
import {
  Panel,
  PrintLink,
  DataTable,
  Status,
  AsyncButton,
  Field,
  Multi,
  Check,
  Notice,
  entryLabel,
  JsonDetails,
} from "./ui";
/** Nom affiché d'un tour : un overall final n'a pas de catégorie dans `state.categories`. */
function roundName(s: State, round: Round): string {
  if (round.grand_final)
    return `Overall final · ${labels[round.section || ""] || round.section || ""}`;
  return s.categories.find((c) => c.id === round.category_id)?.name || "";
}
/** Sous-libellé d'un tour : phase, ou « Toutes disciplines » pour l'overall final. */
function roundPhase(round: Round): string {
  return round.grand_final ? "Toutes disciplines" : labels[round.phase];
}
export function Competition({ s, command }: { s: State; command: Command }) {
  const [selected, setSelected] = useState("");
  const r =
    s.rounds.find((r) => r.id === selected) ||
    s.rounds.find((r) => r.id === s.active_round_id) ||
    s.rounds[0];
  const [discipline, setDiscipline] = useState("bodybuilding"),
    [section, setSection] = useState("amateur"),
    [overallExams, setOverallExams] = useState<string[]>([]);
  const examCandidates = overallExamCandidates(s.users, s.jury?.trainees || []);
  const concordance = useConcordance(s);
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">DIRECTION SPORTIVE</p>
          <h1>Conduite de la compétition</h1>
        </div>
        <AsyncButton
          allowed={canCommand(s.me.roles, "round.next")}
          action={() => command("round.next")}
        >
          Passer à la manche suivante
        </AsyncButton>
      </div>
      <Panel title="Programme sportif">
        <DataTable
          columns={["Catégorie / phase", "État", "Bulletins reçus", "Action"]}
          rows={s.rounds.map((round) => [
            <>
              <strong>{roundName(s, round)}</strong>
              <small>{roundPhase(round)}</small>
            </>,
            <Status value={round.status} />,
            `${round.panel.filter((id) => round.ballots?.[id]).length}/${round.panel.length} officiels · ${round.trainees.filter((id) => round.ballots?.[id]).length}/${round.trainees.length} stagiaires`,
            <button
              className={round.id === r?.id ? "" : "ghost"}
              onClick={() => setSelected(round.id)}
            >
              Ouvrir le dossier
            </button>,
          ])}
        />
      </Panel>
      {r && (
        <RoundControl
          key={r.id}
          r={r}
          s={s}
          command={command}
          concordance={concordance}
        />
      )}
      {concordance && <ConcordanceSummary s={s} concordance={concordance} />}
      <Panel title="Toutes catégories et cycle des récompenses">
        <div className="form-grid">
          <Field label="Discipline">
            <select
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
            >
              {Array.from(new Set(s.categories.map((c) => c.discipline))).map(
                (d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="Section">
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="amateur">Amateur</option>
              <option value="pro">Professionnel</option>
            </select>
          </Field>
        </div>
        {canCommand(s.me.roles, "overall.create") && (
          <>
            <Multi
              title="Stagiaires à examiner sur ce toutes catégories"
              items={examCandidates}
              value={overallExams}
              onChange={setOverallExams}
            />
            <p className="muted">
              Sélectionnez avant la création : le tour peut s’ouvrir
              immédiatement. Seuls les stagiaires approuvés du jury général,
              attendus sur ce tour, sont proposés. La sélection s’ajoute à leur
              programme d’examen.
            </p>
          </>
        )}
        <div className="actions">
          <AsyncButton
            allowed={canCommand(s.me.roles, "overall.create")}
            action={async () => {
              await command("overall.create", {
                discipline,
                section,
                exam_user_ids: selectedOverallExams(
                  overallExams,
                  examCandidates,
                ),
              });
              setOverallExams([]);
            }}
          >
            Créer le toutes catégories
          </AsyncButton>
          <AsyncButton
            allowed={canCommand(s.me.roles, "discipline.advance")}
            className="ghost"
            action={() => command("discipline.advance", { discipline })}
          >
            Clôturer le cycle et avancer
          </AsyncButton>
        </div>
      </Panel>
      {/* Décision PO du 24/09/2026 : un overall par discipline et par sexe, pas de finale toutes
          disciplines. La commande overall.final existe côté serveur mais n'est pas exposée. */}
    </>
  );
}
/**
 * Appel des athlètes avant le premier bulletin (décision PO du 24/09/2026 : un absent ne compte
 * aucun point). Un absent est retiré de la manche et des manches suivantes de la catégorie ;
 * « Rétablir » annule tant qu'aucun bulletin n'est reçu. Après un bulletin : incident.
 */
function Attendance({
  r,
  s,
  command,
}: {
  r: Round;
  s: State;
  command: Command;
}) {
  const [reason, setReason] = useState("");
  const absences = (r.absences || []).filter((a: any) => !a.restored);
  return (
    <Panel title="Présence à l’appel">
      <Notice>
        Un athlète absent est retiré de cette manche et des manches suivantes de
        la catégorie, et ne rapporte aucun point à son club. Possible tant
        qu’aucun bulletin n’est reçu ; ensuite, passez par un incident.
      </Notice>
      <Field label="Motif de l’absence">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Non présenté à l’appel, blessure, forfait…"
        />
      </Field>
      <DataTable
        columns={["Athlète", "Action"]}
        rows={r.participant_ids.map((id) => [
          entryLabel(s, id),
          <AsyncButton
            allowed={canCommand(s.me.roles, "round.absent")}
            className="ghost"
            disabled={!reason}
            action={() =>
              command("round.absent", { round_id: r.id, entry_id: id, reason })
            }
          >
            Déclarer absent
          </AsyncButton>,
        ])}
      />
      {absences.length > 0 && (
        <DataTable
          columns={["Absent", "Motif", "Action"]}
          rows={absences.map((a: any) => [
            entryLabel(s, a.entry_id),
            a.reason,
            <AsyncButton
              allowed={canCommand(s.me.roles, "round.present")}
              className="ghost"
              action={() =>
                command("round.present", {
                  round_id: r.id,
                  entry_id: a.entry_id,
                })
              }
            >
              Rétablir
            </AsyncButton>,
          ])}
        />
      )}
    </Panel>
  );
}
/**
 * Ordre de passage sur scène (PO 24/09/2026) : tiré au sort par le serveur à l'ouverture du tour
 * parmi les athlètes encore en lice ; le chef ou le responsable peut le retirer tant qu'aucun
 * bulletin n'est reçu. Il ne pèse jamais sur le résultat sportif.
 */
function PassageOrder({
  r,
  s,
  command,
}: {
  r: Round;
  s: State;
  command: Command;
}) {
  const order: string[] = Array.isArray(r.passage_order) ? r.passage_order : [];
  const frozen = Object.keys(r.ballots || {}).length > 0;
  const canDraw =
    (r.status === "pending" || r.status === "open") &&
    !frozen &&
    r.participant_ids.length > 0;
  const draws: any[] = Array.isArray(r.draws) ? r.draws : [];
  const last = draws[draws.length - 1];
  const drawnBy = last
    ? last.by
      ? s.users.find((u) => u.id === last.by)?.name || last.by
      : "tirage automatique à l’ouverture"
    : "";
  return (
    <Panel
      title="Ordre de passage"
      actions={
        <div className="actions">
          <AsyncButton
            allowed={canCommand(s.me.roles, "round.draw")}
            disabled={!canDraw}
            action={() => command("round.draw", { round_id: r.id })}
          >
            Tirer l’ordre de passage
          </AsyncButton>
          <PrintLink href={"/api/v1/print/programme?round_id=" + r.id}>Imprimer</PrintLink>
        </div>
      }
    >
      {order.length === 0 ? (
        <Notice>
          Ordre de passage non encore tiré pour ce tour. Il est tiré au sort à
          l’ouverture parmi les athlètes encore en lice.
        </Notice>
      ) : (
        <>
          <p className="muted">
            {order.length} athlète(s)
            {last
              ? ` · ${drawnBy} · ${new Date(Number(last.at) * 1000).toLocaleString("fr-FR")}`
              : ""}
            {frozen ? " · figé : un bulletin a été reçu" : ""}
          </p>
          <ol>
            {order.map((id) => (
              <li key={id}>{entryLabel(s, id)}</li>
            ))}
          </ol>
        </>
      )}
    </Panel>
  );
}
function RoundControl({
  r,
  s,
  command,
  concordance,
}: {
  r: Round;
  s: State;
  command: Command;
  concordance: ConcordanceReport | null;
}) {
  const [reason, setReason] = useState(""),
    [judge, setJudge] = useState(""),
    [ranking, setRanking] = useState<string[]>([]),
    [signature, setSignature] = useState(""),
    [qualified, setQualified] = useState<string[]>([]),
    [remove, setRemove] = useState<string[]>([]),
    [panel, setPanel] = useState(r.panel),
    [trainees, setTrainees] = useState(r.trainees),
    [quota, setQuota] = useState(r.quota || 6);
  const isElimination = r.phase === "elimination";
  const rows = Array.isArray(r.result?.official) ? r.result.official : [];
  return (
    <>
      <Panel
        title={`${roundName(s, r)} · ${roundPhase(r)}`}
        actions={<Status value={r.status} />}
      >
        <div className="actions">
          <AsyncButton
            allowed={canCommand(s.me.roles, "round.open")}
            disabled={r.status !== "pending"}
            action={() => command("round.open", { round_id: r.id })}
          >
            Ouvrir cette manche
          </AsyncButton>
          <AsyncButton
            allowed={canCommand(s.me.roles, "round.open") && ["chief", "responsable"].some((x) => s.me.roles.includes(x))}
            className="ghost danger"
            disabled={r.status !== "pending" || !!s.active_round_id}
            action={async () => {
              if (!window.confirm("Ouvrir cette manche hors de l’ordre préétabli (autre discipline ou autre phase) ? Refusé si une autre manche est ouverte ou si ses participants ne sont pas encore connus.")) return;
              await command("round.open", { round_id: r.id, force: true });
            }}
          >
            Ouvrir hors ordre
          </AsyncButton>
          <AsyncButton
            allowed={canCommand(s.me.roles, "round.validate")}
            action={() =>
              command("round.validate", {
                round_id: r.id,
                reason,
                ...(qualified.length ? { qualified_ids: qualified } : {}),
              })
            }
          >
            Valider les résultats sportifs
          </AsyncButton>
          {r.phase === "overall" && (
            <AsyncButton
              allowed={canCommand(s.me.roles, "overall.confirm")}
              action={() => command("overall.confirm", { round_id: r.id })}
            >
              Confirmer le toutes catégories
            </AsyncButton>
          )}
        </div>
        <div className="metrics">
          <div>
            <strong>
              {r.panel.filter((id) => r.ballots?.[id]).length} /{" "}
              {r.panel.length}
            </strong>
            <span>Juges officiels reçus</span>
          </div>
          <div>
            <strong>
              {r.trainees.filter((id) => r.ballots?.[id]).length} /{" "}
              {r.trainees.length}
            </strong>
            <span>Stagiaires reçus</span>
          </div>
          <div>
            <strong>{r.expired_trainees?.length || 0}</strong>
            <span>Stagiaires hors délai</span>
          </div>
        </div>
        <div className="receipt-grid">
          {[...r.panel, ...r.trainees].map((id) => (
            <div
              className={"receipt " + (r.ballots?.[id] ? "received" : "")}
              key={id}
            >
              <strong>{s.users.find((u) => u.id === id)?.name || id}</strong>
              <span>
                {r.ballots?.[id]
                  ? "Reçu"
                  : r.expired_trainees?.includes(id)
                    ? "Délai expiré"
                    : "En attente"}
              </span>
              <small>
                {r.trainees.includes(id) ? "Stagiaire" : "Officiel"}
              </small>
            </div>
          ))}
        </div>
        {r.result && (
          <>
            <DataTable
              columns={["Rang", "Athlète", "Total"]}
              rows={rows.map((row: any, i: number) => [
                row.rank ?? row.place ?? i + 1,
                entryLabel(s, row.entry_id || row.id || row),
                row.score ?? row.total ?? "—",
              ])}
            />
            <JsonDetails
              label="Calculs, versions et classements"
              data={r.result}
            />
          </>
        )}
        {concordance && (
          <ConcordanceRoundPanel r={r} s={s} concordance={concordance} />
        )}
        <PassageOrder r={r} s={s} command={command} />
        {(r.status === "pending" || r.status === "open") &&
          !Object.keys(r.ballots || {}).length && (
            <Attendance r={r} s={s} command={command} />
          )}
        <Multi
          title="Qualification explicite si un arbitrage est requis"
          items={r.participant_ids.map((id) => ({
            id,
            name: entryLabel(s, id),
          }))}
          value={qualified}
          onChange={setQualified}
        />
      </Panel>
      <div className="split">
        <Panel title="Configuration de cette manche">
          <Multi
            title="Juges officiels"
            items={s.users.filter(
              (u) =>
                u.approved &&
                !u.roles.includes("director") &&
                !u.roles.includes("trainee") &&
                (u.roles.includes("judge") ||
                  u.roles.includes("chief") ||
                  u.roles.includes("responsable")),
            )}
            value={panel}
            onChange={setPanel}
          />
          <Multi
            title="Stagiaires"
            items={s.users.filter(
              (u) => u.approved && u.roles.includes("trainee"),
            )}
            value={trainees}
            onChange={setTrainees}
          />
          <Field label="Quota">
            <input
              type="number"
              min="1"
              value={quota}
              onChange={(e) => setQuota(Number(e.target.value))}
            />
          </Field>
          <AsyncButton
            allowed={canCommand(s.me.roles, "round.configure")}
            action={() =>
              command("round.configure", {
                round_id: r.id,
                panel,
                trainees,
                quota,
              })
            }
          >
            Appliquer à cette manche
          </AsyncButton>
        </Panel>
        <Panel title="Incident et réduction de jury">
          <Field label="Motif documenté">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Décrire l’incident ou la justification de correction…"
            />
          </Field>
          <div className="actions">
            <AsyncButton
              allowed={canCommand(s.me.roles, "round.incident")}
              disabled={!reason}
              action={() =>
                command("round.incident", { round_id: r.id, reason })
              }
            >
              Suspendre et consigner
            </AsyncButton>
            <AsyncButton
              allowed={canCommand(s.me.roles, "round.resolve")}
              className="ghost"
              disabled={!reason}
              action={() =>
                command("round.resolve", { round_id: r.id, reason })
              }
            >
              Résoudre l’incident
            </AsyncButton>
          </div>
          <Multi
            title="Retirer du jury selon l’ordre autorisé"
            items={r.panel.map((id) => ({
              id,
              name: s.users.find((u) => u.id === id)?.name || id,
            }))}
            value={remove}
            onChange={setRemove}
          />
          <AsyncButton
            allowed={canCommand(s.me.roles, "panel.reduce")}
            disabled={!reason || !remove.length}
            action={() =>
              command("panel.reduce", {
                round_id: r.id,
                remove_ids: remove,
                reason,
              })
            }
          >
            Appliquer le retrait motivé
          </AsyncButton>
        </Panel>
      </div>
      <Panel title="Saisie papier et correction contrôlée">
        <Notice>
          Le bulletin original reste conservé. Une correction après publication
          nécessite les signatures du chef et d’un directeur distinct. Le
          serveur vérifie les droits et les signatures.
        </Notice>
        <div className="form-grid">
          <Field label="Juge concerné">
            <select
              value={judge}
              onChange={(e) => {
                setJudge(e.target.value);
                setRanking([]);
              }}
            >
              <option value="">Choisir…</option>
              {[...r.panel, ...r.trainees].map((id) => (
                <option key={id} value={id}>
                  {s.users.find((u) => u.id === id)?.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Signature de la feuille papier">
            <input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
            />
          </Field>
        </div>
        <p>
          {isElimination
            ? `Sélectionnez ${r.quota} athlètes.`
            : "Ajoutez les athlètes dans l’ordre du classement : premier, deuxième, etc."}
        </p>
        <select
          value=""
          aria-label="Ajouter un athlète au bulletin"
          onChange={(e) => setRanking([...ranking, e.target.value])}
        >
          <option value="">Ajouter un athlète…</option>
          {r.participant_ids
            .filter((id) => !ranking.includes(id))
            .map((id) => (
              <option key={id} value={id}>
                {entryLabel(s, id)}
              </option>
            ))}
        </select>
        <ol>
          {ranking.map((id) => (
            <li key={id}>
              {entryLabel(s, id)}{" "}
              <button
                className="ghost"
                onClick={() => setRanking(ranking.filter((x) => x !== id))}
              >
                Retirer
              </button>
            </li>
          ))}
        </ol>
        <Field label="Motif de saisie ou correction">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <div className="actions">
          <AsyncButton
            allowed={canCommand(s.me.roles, "paper.submit")}
            disabled={!judge || !reason || !signature}
            action={() =>
              command("paper.submit", {
                round_id: r.id,
                judge_id: judge,
                ...(isElimination ? { selected: ranking } : { ranking }),
                signature,
                reason,
              })
            }
          >
            Enregistrer le bulletin papier
          </AsyncButton>
          <AsyncButton
            allowed={canCommand(s.me.roles, "round.correct")}
            disabled={!judge || !reason}
            action={() =>
              command("round.correct", {
                round_id: r.id,
                judge_id: judge,
                ...(isElimination ? { selected: ranking } : { ranking }),
                reason,
              })
            }
          >
            Soumettre la correction
          </AsyncButton>
          <AsyncButton
            allowed={canCommand(s.me.roles, "correction.sign")}
            className="ghost"
            action={() => command("correction.sign", { round_id: r.id })}
          >
            Signer la correction en attente
          </AsyncButton>
        </div>
        {r.correction && (
          <JsonDetails data={r.correction} label="Correction et signatures" />
        )}
      </Panel>
    </>
  );
}
/** Réponse de GET /api/v1/concordance (voir server/concordance.ts) : jamais servie aux juges. */
type ConcordanceReport = {
  chief_id: string | null;
  rounds: {
    round_id: string;
    reference_source: "validated" | "ballot";
    reference_version: unknown;
    judges: {
      user_id: string;
      trainee: boolean;
      score: { display: string } | null;
      pairs: number;
      comparable: boolean;
    }[];
  }[];
  judges: {
    user_id: string;
    trainee: boolean;
    mean: { display: string } | null;
    rounds: number;
    pairs: number;
  }[];
};
/**
 * Concordance des juges avec le bulletin du chef (PO, 26/09/2026) : chargée seulement pour le
 * chef et le responsable, les autres rôles ne voient rien (le serveur répond 403 de toute façon).
 */
function useConcordance(s: State): ConcordanceReport | null {
  const allowed = s.me.roles.some((role: string) =>
    ["chief", "responsable"].includes(role),
  );
  const [report, setReport] = useState<ConcordanceReport | null>(null);
  useEffect(() => {
    if (!allowed) {
      setReport(null);
      return;
    }
    let live = true;
    api("/concordance")
      .then((data) => live && setReport(data))
      .catch(() => live && setReport(null));
    return () => {
      live = false;
    };
  }, [allowed, s.version]);
  return report;
}
const userName = (s: State, id: string) =>
  s.users.find((u) => u.id === id)?.name || id;
/** Panneau « Concordance avec le chef » d'une manche : par juge, pourcentage et paires comparées. */
function ConcordanceRoundPanel({
  r,
  s,
  concordance,
}: {
  r: Round;
  s: State;
  concordance: ConcordanceReport;
}) {
  const round = concordance.rounds.find((x) => x.round_id === r.id);
  if (r.phase === "elimination") return null;
  return (
    <Panel title="Concordance avec le chef">
      {!round ? (
        <Notice kind="info">
          En attente du bulletin du chef de jury : aucune comparaison tant
          qu'il n'est pas reçu.
        </Notice>
      ) : (
        <>
          <p>
            {round.reference_source === "validated"
              ? "Référence : bulletin du chef gelé à la validation"
              : "Référence : bulletin actuel du chef (avant validation)"}
            {round.reference_version != null
              ? ` (version ${String(round.reference_version)})`
              : ""}
            . Même calcul que l'examen des stagiaires : part des paires
            d'athlètes classées dans le même ordre que le chef.
          </p>
          <DataTable
            columns={["Juge", "Concordance", "Paires comparées", "Bulletin"]}
            rows={round.judges.map((j) => [
              <>
                <strong>{userName(s, j.user_id)}</strong>
                <small>{j.trainee ? "Stagiaire" : "Officiel"}</small>
              </>,
              j.score ? j.score.display + " %" : "—",
              j.comparable ? j.pairs : "—",
              j.comparable
                ? "Comparé"
                : r.ballots?.[j.user_id]
                  ? "Non comparable"
                  : "Non reçu",
            ])}
          />
        </>
      )}
    </Panel>
  );
}
/** Récapitulatif par juge sur toute la compétition : moyenne non pondérée des manches comparées. */
function ConcordanceSummary({
  s,
  concordance,
}: {
  s: State;
  concordance: ConcordanceReport;
}) {
  return (
    <Panel title="Concordance avec le chef sur la compétition">
      <p>
        Moyenne par juge des concordances avec le bulletin du chef, sur les
        manches où son bulletin et celui du chef sont reçus (éliminatoires
        exclues : bulletin de sélection, pas de classement). Visible seulement
        par le chef de jury et le responsable.
      </p>
      <DataTable
        columns={["Juge", "Moyenne", "Manches comparées", "Paires comparées"]}
        rows={concordance.judges.map((j) => [
          <>
            <strong>{userName(s, j.user_id)}</strong>
            <small>{j.trainee ? "Stagiaire" : "Officiel"}</small>
          </>,
          j.mean ? j.mean.display + " %" : "—",
          j.rounds,
          j.pairs,
        ])}
      />
    </Panel>
  );
}
export function Exams({ s, command }: { s: State; command: Command }) {
  const [report, setReport] = useState<any>({ reports: [] }),
    [error, setError] = useState(""),
    [user, setUser] = useState(""),
    [rounds, setRounds] = useState<string[]>([]),
    [decision, setDecision] = useState("approved"),
    [reason, setReason] = useState("");
  useEffect(() => {
    api("/exams")
      .then(setReport)
      .catch((e) => setError(e.message));
  }, [s.version]);
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">COMMISSION</p>
          <h1>Examen des stagiaires</h1>
        </div>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {(canCommand(s.me.roles, "exam.program") ||
        canCommand(s.me.roles, "exam.decide")) && (
        <Panel title="Planifier et décider">
          <Notice>
            La référence est le bulletin versionné du chef. L’admissibilité
            demande 4 catégories, 60 paires, tous les bulletins planifiés reçus
            et une moyenne brute de 85 %. Les éliminatoires sont exclus.
          </Notice>
          <Field label="Stagiaire">
            <select value={user} onChange={(e) => setUser(e.target.value)}>
              <option value="">Choisir…</option>
              {s.users
                .filter((u) =>
                  u.roles.some((role: string) =>
                    ["trainee", "judge", "responsable"].includes(role),
                  ),
                )
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </Field>
          <Multi
            title="Manches planifiées"
            items={s.rounds
              .filter((r) => r.phase !== "elimination")
              .map((r) => ({
                id: r.id,
                name: `${s.categories.find((c) => c.id === r.category_id)?.name} · ${labels[r.phase]}`,
              }))}
            value={rounds}
            onChange={setRounds}
          />
          <AsyncButton
            allowed={canCommand(s.me.roles, "exam.program")}
            disabled={!user || !rounds.length}
            action={() =>
              command("exam.program", { user_id: user, round_ids: rounds })
            }
          >
            Enregistrer le programme d’examen
          </AsyncButton>
          <div className="form-grid">
            <Field label="Décision de la commission">
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
              >
                <option value="approved">Admis</option>
                <option value="rejected">Non admis</option>
                <option value="deferred">Ajourné</option>
              </select>
            </Field>
            <Field label="Motif">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </div>
          <AsyncButton
            allowed={canCommand(s.me.roles, "exam.decide")}
            disabled={!user || !reason}
            action={() =>
              command("exam.decide", { user_id: user, decision, reason })
            }
          >
            Consigner la décision signée
          </AsyncButton>
        </Panel>
      )}
      {(report.reports || []).map((r: any) => (
        <Panel
          key={r.user_id}
          title={s.users.find((u) => u.id === r.user_id)?.name || r.user_id}
        >
          <div className="metrics">
            <div>
              <strong>{r.mean?.display ?? "—"} %</strong>
              <span>Moyenne non pondérée</span>
            </div>
            <div>
              <strong>{r.categories} / 4</strong>
              <span>Catégories évaluées</span>
            </div>
            <div>
              <strong>{r.pairs} / 60</strong>
              <span>Paires comparées</span>
            </div>
          </div>
          <Notice kind={r.passed ? "success" : "warning"}>
            {r.passed
              ? "Conditions de réussite atteintes ; décision de commission attendue."
              : "Conditions de réussite non atteintes ou examen incomplet."}{" "}
            {r.missing?.length || 0} bulletin(s) planifié(s) manquant(s) ou en
            attente de référence validée.
          </Notice>
          <DataTable
            columns={["Manche", "Concordance", "Paires", "Version référence"]}
            rows={(r.details || []).map((d: any) => [
              s.categories.find(
                (c) =>
                  c.id ===
                  s.rounds.find((round) => round.id === d.round_id)
                    ?.category_id,
              )?.name,
              d.score?.display + " %",
              d.pairs,
              d.reference_version,
            ])}
          />
          <JsonDetails
            label="Rapport détaillé, concordances et conditions"
            data={r}
          />
          <PrintLink href={"/api/v1/print/exams?judge_id=" + r.user_id}>Imprimer le rapport</PrintLink>
        </Panel>
      ))}
    </>
  );
}
export function Collective({ s, command }: { s: State; command: Command }) {
  const [data, setData] = useState<any>({ club: [], country: [] }),
    [error, setError] = useState(""),
    [kind, setKind] = useState("club"),
    [winner, setWinner] = useState(""),
    [reason, setReason] = useState("");
  useEffect(() => {
    api("/collective")
      .then(setData)
      .catch((e) => setError(e.message));
  }, [s.version]);
  return (
    <>
      <div className="page-title">
        <h1>Classements collectifs</h1>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <Notice kind={data.complete ? "success" : "warning"}>
        {data.complete
          ? "Toutes les finales sont validées. Les récompenses collectives sont créées dès que le vainqueur est établi."
          : "Classement provisoire : des finales restent à valider. Aucune récompense collective définitive n’est attribuée."}
      </Notice>
      <div className="split">
        {["club", "country"].filter((k) => k === "club" || s.mode === "international").map((k) => (
          <Panel title={k === "club" ? "Clubs" : "Pays"} key={k}>
            {data.winners?.[k] ? (
              <p>
                <strong>Vainqueur : {data.winners[k]}</strong>
              </p>
            ) : data.complete && data[k]?.length ? (
              <Notice>Départage requis avant attribution.</Notice>
            ) : null}
            <DataTable
              columns={["Rang", "Collectif", "Points"]}
              rows={(data[k] || []).map((r: any, i: number) => [
                r.rank || i + 1,
                r.name || r[k] || r.key,
                r.points ?? r.total,
              ])}
            />
          </Panel>
        ))}
      </div>
      <Panel title="Départage documenté">
        <div className="form-grid">
          <Field label="Classement">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="club">Club</option>
              {s.mode === "international" && <option value="country">Pays</option>}
            </select>
          </Field>
          <Field label="Vainqueur">
            <input value={winner} onChange={(e) => setWinner(e.target.value)} />
          </Field>
          <Field label="Motif et procédure appliquée">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </div>
        <AsyncButton
          allowed={canCommand(s.me.roles, "collective.decide")}
          disabled={!winner || !reason}
          action={() => command("collective.decide", { kind, winner, reason })}
        >
          Signer le départage
        </AsyncButton>
        <JsonDetails label="Décisions consignées" data={data.decisions} />
      </Panel>
    </>
  );
}
