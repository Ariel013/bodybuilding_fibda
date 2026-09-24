import { AthleteCard } from "./AthleteCard";
import { ConnectionHelp } from "./ConnectionHelp";
import { useEffect, useRef, useState } from "react";
import {
  type State,
  type Round,
  type Command,
  labels,
  personName,
} from "./types";
import {
  complete,
  draftKey,
  place,
  remove,
  selectionValid,
  secondsRemaining,
  type Ranking,
} from "./ranking";
import { draftGet, draftSave, draftDelete, type Draft } from "./drafts";
import { Notice, Panel, Empty, Status } from "./ui";
import { chosenRoundId } from "./judgeSelection";
type Snapshot = { ranking: Ranking; selected: string[] };
export function Judge({ s, command }: { s: State; command: Command }) {
  const eligible = s.rounds.filter(
    (r) => r.panel?.includes(s.me.id) || r.trainees?.includes(s.me.id),
  );
  const [chosen, setChosen] = useState<{ id: string; active: string | null }>();
  useEffect(() => setChosen(undefined), [s.active_round_id, s.restore_id]);
  const round =
    eligible.find((r) => r.id === chosenRoundId(chosen, s.active_round_id)) ||
    eligible.find((r) => r.id === s.active_round_id) ||
    eligible.find((r) => r.status === "open") ||
    eligible.at(-1);
  return (
    <div className="judge-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">BULLETIN PERSONNEL</p>
          <h1>Mon jugement</h1>
        </div>
        <select
          aria-label="Manche à juger"
          value={round?.id || ""}
          onChange={(e) =>
            setChosen({ id: e.target.value, active: s.active_round_id })
          }
        >
          {eligible.map((r) => (
            <option key={r.id} value={r.id}>
              {s.categories.find((c) => c.id === r.category_id)?.name} ·{" "}
              {labels[r.phase]} · {labels[r.status]}
            </option>
          ))}
        </select>
      </div>
      {round ? (
        <Ballot
          key={`${s.restore_id}-${s.me.id}-${round.id}-${round.version}`}
          s={s}
          round={round}
          command={command}
        />
      ) : (
        <Panel>
          <Empty>
            Aucune manche affectée. Le chef de jury doit vous intégrer au jury
            et ouvrir une manche.
          </Empty>
        </Panel>
      )}
      {round && <AthleteCard key={round.id} s={s} round={round} />}
      <ConnectionHelp />
    </div>
  );
}
function Ballot({
  s,
  round: r,
  command,
}: {
  s: State;
  round: Round;
  command: Command;
}) {
  const ids = r.participant_ids;
  const key = draftKey(s.id, s.restore_id, s.me.id, r.id, r.version || 1);
  const [snap, setSnap] = useState<Snapshot>({
    ranking: ids.map(() => null),
    selected: [],
  });
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [pending, setPending] = useState<Draft>();
  const [chosen, setChosen] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const dragStart = useRef<{
    id: string;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const serverAnchor = useRef({ server: 0, local: Date.now() });
  useEffect(() => {
    const t =
      typeof s.server_time === "number"
        ? s.server_time
        : Date.parse(s.server_time) / 1000;
    serverAnchor.current = {
      server: t || Date.now() / 1000,
      local: Date.now(),
    };
  }, [s.server_time]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const trainee = r.trainees.includes(s.me.id);
  const remaining = secondsRemaining(
    r.trainee_deadline,
    serverAnchor.current.server + (now - serverAnchor.current.local) / 1000,
  );
  const received = r.ballots?.[s.me.id] || ack;
  const locked =
    !!received || busy || r.status !== "open" || (trainee && remaining === 0);
  const elimination = r.phase === "elimination";
  const valid = elimination
    ? selectionValid(snap.selected, ids, r.quota)
    : complete(snap.ranking, ids);
  useEffect(() => {
    draftGet(key)
      .then((d) => {
        if (d) setPending(d);
      })
      .catch(() =>
        setError("Stockage local indisponible : gardez cette page ouverte."),
      );
  }, [key]);
  function change(next: Snapshot) {
    if (locked) return;
    setPast((p) => [...p, snap]);
    setFuture([]);
    setSnap(next);
    setConfirm(false);
    persist(next);
  }
  function persist(next: Snapshot) {
    draftSave({ key, ...next, saved_at: new Date().toISOString() })
      .then(() => setSaved(new Date().toLocaleTimeString("fr-FR")))
      .catch(() => setError("Brouillon non enregistré sur cet appareil."));
  }
  function put(id: string, rank: number) {
    change({ ...snap, ranking: place(snap.ranking, id, rank) });
    setChosen(null);
  }
  function pointerDown(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (locked || elimination) return;
    dragStart.current = { id, x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const start = dragStart.current;
    if (!start) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) {
      start.moved = true;
      setDrag({ id: start.id, x: e.clientX, y: e.clientY });
    }
  }
  function pointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const start = dragStart.current;
    if (!start) return;
    dragStart.current = null;
    setDrag(null);
    if (start.moved) {
      const slot = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>("[data-rank]");
      if (slot) put(start.id, Number(slot.dataset.rank));
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const result = await command("ballot.submit", {
        round_id: r.id,
        ...(elimination
          ? { selected: snap.selected }
          : { ranking: snap.ranking }),
        restore_id: s.restore_id,
      });
      setAck(
        result?.state?.rounds?.find((x: Round) => x.id === r.id)?.ballots?.[
          s.me.id
        ] || { received_at: new Date().toISOString(), ...snap },
      );
      await draftDelete(key);
      setPending(undefined);
      setConfirm(false);
    } catch (e) {
      setError((e as Error).message);
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }
  const layout = (
    <div className={"judge-layout" + (elimination ? " elimination" : "")}>
      <Panel title={elimination ? "Athlètes à sélectionner" : "Dossards"}>
        <div className="bib-grid">
          {ids.map((id) => {
            const entry = s.entries.find((e) => e.id === id);
            const p = s.people.find((p) => p.id === entry?.person_id);
            const selected = elimination
              ? (received?.selected || snap.selected).includes(id)
              : chosen === id;
            const rank = snap.ranking.indexOf(id);
            return (
              <button
                key={id}
                className={`bib ${selected ? "selected" : ""} ${rank >= 0 && !elimination ? "placed" : ""}`}
                disabled={locked}
                onPointerDown={(e) => pointerDown(e, id)}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                onPointerCancel={() => {
                  dragStart.current = null;
                  setDrag(null);
                }}
                onClick={() => {
                  if (elimination)
                    change({
                      ...snap,
                      selected: selected
                        ? snap.selected.filter((i) => i !== id)
                        : snap.selected.length < r.quota
                          ? [...snap.selected, id]
                          : snap.selected,
                    });
                  else setChosen(id);
                }}
              >
                <strong>{entry?.bib ?? "—"}</strong>
                <span>{personName(p)}</span>
                {!elimination && rank >= 0 && <small>Rang {rank + 1}</small>}
                {elimination && selected && <small>Sélectionné</small>}
              </button>
            );
          })}
        </div>
      </Panel>
      {!elimination && (
        <Panel title="Rangs">
          <ol className="ranks">
            {(received?.ranking || snap.ranking).map(
              (id: string | null, i: number) => {
                const e = s.entries.find((e) => e.id === id);
                return (
                  <li key={i} data-rank={i}>
                    <button
                      className={"rank-slot " + (chosen ? "target" : "")}
                      disabled={locked || !chosen}
                      onClick={() => chosen && put(chosen, i)}
                    >
                      <span className="rank-number">{i + 1}</span>
                      {id ? (
                        <span>
                          <strong>N° {e?.bib}</strong> ·{" "}
                          {personName(
                            s.people.find((p) => p.id === e?.person_id),
                          )}
                        </span>
                      ) : (
                        <span className="muted">
                          {chosen ? "Attribuer ici" : "Libre"}
                        </span>
                      )}
                    </button>
                    {id && !locked && (
                      <button
                        className="icon ghost"
                        aria-label={`Libérer le rang ${i + 1}`}
                        onClick={() =>
                          change({
                            ...snap,
                            ranking: remove(snap.ranking, id),
                          })
                        }
                      >
                        ×
                      </button>
                    )}
                  </li>
                );
              },
            )}
          </ol>
        </Panel>
      )}
    </div>
  );
  return (
    <>
      <div className="ballot-context">
        <Panel>
          <div className="judge-event-context">
            <img src="/assets/fibda-logo.jpg" alt="FIBDA" />
            <strong>{s.name}</strong>
            <span>
              {labels[
                s.categories.find((c) => c.id === r.category_id)?.section ||
                  r.section
              ] || "Section non précisée"}
            </span>
          </div>
          <div className="panel-head">
            <div>
              <h2>{s.categories.find((c) => c.id === r.category_id)?.name}</h2>
              <p>
                {labels[r.phase]} · {ids.length} athlètes ·{" "}
                {trainee
                  ? "Bulletin stagiaire, hors calcul officiel"
                  : "Bulletin officiel"}
              </p>
            </div>
            <Status value={r.status} />
          </div>
          {trainee && remaining !== null && (
            <Notice kind={remaining < 15 ? "warning" : "info"}>
              Temps restant après le dernier juge officiel :{" "}
              <strong>{remaining} s</strong>
            </Notice>
          )}
          {error && <Notice kind="error">{error}</Notice>}
          {received ? (
            <Notice kind="success">
              <strong>Bulletin reçu et verrouillé par le serveur.</strong>{" "}
              {receivedAt(received)}
              <p>Aucune nouvelle soumission n’est nécessaire.</p>
            </Notice>
          ) : (
            <>
              {elimination ? (
                <p>Sélectionnez exactement {r.quota} athlètes.</p>
              ) : (
                <details className="ballot-help">
                  <summary>Dossard → rang · glisser ou toucher</summary>
                  <p>
                    Touchez un dossard puis un rang, ou glissez-le. Remplacer un
                    rang libère son précédent occupant sans décaler les autres.
                  </p>
                </details>
              )}
              {pending && (
                <Notice kind="warning">
                  Un brouillon de cette manche existe sur cet appareil. Il n’a
                  pas été envoyé.
                  <div className="actions">
                    <button
                      disabled={locked}
                      onClick={() => {
                        setSnap({
                          ranking: pending.ranking,
                          selected: pending.selected,
                        });
                        setPending(undefined);
                      }}
                    >
                      Reprendre le brouillon
                    </button>
                    <button
                      className="ghost"
                      onClick={() => {
                        draftDelete(key);
                        setPending(undefined);
                      }}
                    >
                      Écarter le brouillon
                    </button>
                  </div>
                </Notice>
              )}
            </>
          )}
        </Panel>
      </div>
      {received && <WaitingScreen round={r} received={received} />}
      {r.status === "pending" && !received && (
        <div className="judge-waiting upcoming" role="status">
          <strong>Manche à venir.</strong>
          <p>
            Cette manche n’est pas encore ouverte. Le bulletin s’affichera ici
            automatiquement à son ouverture, sans recharger la page.
          </p>
        </div>
      )}
      {received ? (
        <details className="ballot-sent">
          <summary>Voir mon bulletin transmis</summary>
          {layout}
        </details>
      ) : (
        layout
      )}
      {!received && (
        <div className="ballot-footer">
          <div>
            <strong>
              {elimination
                ? `${snap.selected.length} / ${r.quota} sélectionnés`
                : `${snap.ranking.filter(Boolean).length} / ${ids.length} rangs attribués`}
            </strong>
            <small>
              {saved
                ? `Brouillon local enregistré à ${saved}`
                : "Aucun bulletin transmis"}
            </small>
          </div>
          <div className="actions">
            <button
              className="ghost"
              disabled={!past.length || locked}
              onClick={() => {
                const previous = past.at(-1)!;
                setFuture((f) => [snap, ...f]);
                setPast((p) => p.slice(0, -1));
                setSnap(previous);
                persist(previous);
              }}
            >
              Annuler
            </button>
            <button
              className="ghost"
              disabled={!future.length || locked}
              onClick={() => {
                const next = future[0];
                setPast((p) => [...p, snap]);
                setFuture((f) => f.slice(1));
                setSnap(next);
                persist(next);
              }}
            >
              Rétablir
            </button>
            <button
              disabled={!valid || locked}
              onClick={() => setConfirm(true)}
            >
              Vérifier et valider
            </button>
          </div>
        </div>
      )}
      {confirm && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="modal"
          >
            <h2 id="confirm-title">Validation définitive du bulletin</h2>
            <p>
              Relisez votre {elimination ? "sélection" : "classement"}. Après
              réception, seul le circuit de correction du chef de jury permettra
              une modification.
            </p>
            <ol>
              {(elimination ? snap.selected : snap.ranking).map((id) => {
                const e = s.entries.find((e) => e.id === id);
                return (
                  <li key={id}>
                    N° {e?.bib} ·{" "}
                    {personName(s.people.find((p) => p.id === e?.person_id))}
                  </li>
                );
              })}
            </ol>
            <div className="actions">
              <button
                className="ghost"
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                Revenir au bulletin
              </button>
              <button disabled={busy} onClick={submit}>
                {busy ? "Envoi en cours…" : "Confirmer et transmettre"}
              </button>
            </div>
          </section>
        </div>
      )}
      {drag && (
        <div className="drag-bib" style={{ left: drag.x, top: drag.y }}>
          N° {s.entries.find((e) => e.id === drag.id)?.bib}
        </div>
      )}
    </>
  );
}
/** Heure de réception d'un bulletin, telle que renvoyée par le serveur (secondes ou ISO). */
function receivedAt(received: any): string {
  if (!received?.received_at) return "";
  return new Date(
    typeof received.received_at === "number"
      ? received.received_at * 1000
      : received.received_at,
  ).toLocaleString("fr-FR");
}
/**
 * Écran d'attente après réception du bulletin (demande du PO, 24/09/2026). L'état projeté pour un
 * juge ne contient que son propre bulletin (`projectState` retire ceux des autres) : aucun compteur
 * « reçus x/y » n'est donc affiché. Ce que le serveur laisse voir : l'état de la manche et, une fois
 * tous les bulletins officiels reçus, le délai stagiaire (`trainee_deadline`) fixé par le serveur.
 * Quand le chef valide, le serveur ouvre la manche suivante (`tick` → `tryNext`) et l'état actualisé
 * remplace cet écran sans action du juge.
 */
function WaitingScreen({
  round: r,
  received,
}: {
  round: Round;
  received: any;
}) {
  const officialsDone =
    r.trainee_deadline !== null && r.trainee_deadline !== undefined;
  const stage =
    r.status === "open"
      ? officialsDone
        ? "Tous les bulletins des juges officiels sont reçus. Les stagiaires disposent de leur délai, puis le chef de jury valide."
        : "La manche est en cours : le serveur attend les autres bulletins."
      : r.status === "awaiting_validation"
        ? "Tous les bulletins sont reçus. Le chef de jury valide les résultats."
        : r.status === "suspended"
          ? "Manche suspendue par le chef de jury."
          : "Manche validée par le chef de jury.";
  return (
    <div className="judge-waiting" role="status" aria-live="polite">
      <span className="judge-waiting-mark" aria-hidden="true">
        ✓
      </span>
      <strong>Bulletin validé et reçu.</strong>
      <p className="judge-waiting-main">
        Patientez : la prochaine manche s’affichera ici automatiquement.
      </p>
      <p className="judge-waiting-stage">
        <span className="badge">{labels[r.status]}</span> {stage}
      </p>
      {receivedAt(received) && (
        <small>Reçu par le serveur le {receivedAt(received)}</small>
      )}
    </div>
  );
}
