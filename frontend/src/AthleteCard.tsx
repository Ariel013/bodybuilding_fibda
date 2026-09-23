import { useRef, useState } from "react";
import { type State, type Round, personName } from "./types";
import { photoFor } from "./projection";
export function AthleteCard({ s, round }: { s: State; round: Round }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const entries = s.entries.filter((e) => round.participant_ids.includes(e.id));
  const [selected, setSelected] = useState(entries[0]?.id || "");
  const entry = entries.find((e) => e.id === selected);
  const person = s.people.find((p) => p.id === entry?.person_id);
  const photo = photoFor(person, "full", true);
  return (
    <>
      <button
        className="ghost athlete-card-open"
        disabled={!entries.length}
        onClick={() => dialog.current?.showModal()}
      >
        Voir un athlète
      </button>
      <dialog
        ref={dialog}
        className="modal athlete-card"
        aria-labelledby="athlete-card-title"
      >
        <h2 id="athlete-card-title">Fiche athlète</h2>
        <label>
          Athlète de ce tour
          <select
            autoFocus
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {entries.map((e) => (
              <option key={e.id} value={e.id}>
                N° {e.bib} ·{" "}
                {personName(s.people.find((p) => p.id === e.person_id))}
              </option>
            ))}
          </select>
        </label>
        <h3>
          N° {entry?.bib} · {personName(person)}
        </h3>
        {photo ? (
          <img
            className="athlete-card-photo"
            src={"/api/v1/photos/" + photo}
            alt={personName(person)}
          />
        ) : (
          <p>Aucune photo autorisée disponible.</p>
        )}
        {person?.measurements_confirmed ? (
          <dl>
            <dt>Taille confirmée</dt>
            <dd>{person.height_cm ?? "—"} cm</dd>
            <dt>Poids confirmé</dt>
            <dd>{person.weight_kg ?? "—"} kg</dd>
          </dl>
        ) : (
          <p>Mesures non confirmées.</p>
        )}
        <form method="dialog">
          <button className="wide">Revenir au jugement</button>
        </form>
      </dialog>
    </>
  );
}
