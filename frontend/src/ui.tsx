import { useState, type ReactNode } from "react";
import { type Entity, type State, personName, labels } from "./types";
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Notice({
  children,
  kind = "info",
  className = "",
}: {
  children: ReactNode;
  kind?: string;
  className?: string;
}) {
  return (
    <div
      className={"notice " + kind + (className ? " " + className : "")}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return <span className={"badge " + value}>{labels[value] || value}</span>;
}
export function Panel({
  title,
  children,
  actions,
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="panel">
      {title && (
        <div className="panel-head">
          <h2>{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
export function Check({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
export function Multi({
  title,
  items,
  value,
  onChange,
}: {
  title: string;
  items: Entity[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset>
      <legend>{title}</legend>
      <div className="checks">
        {items.map((p) => (
          <Check
            key={p.id}
            label={p.name || personName(p)}
            value={value.includes(p.id)}
            onChange={(v) =>
              onChange(v ? [...value, p.id] : value.filter((id) => id !== p.id))
            }
          />
        ))}
      </div>
    </fieldset>
  );
}
export function entryLabel(s: State, id: string) {
  const e = s.entries.find((e) => e.id === id);
  const p = s.people.find((p) => p.id === e?.person_id);
  return `${e?.bib ? "N° " + e.bib : "Sans dossard"} · ${personName(p)}`;
}
export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty>Aucun élément pour le moment.</Empty>}
    </div>
  );
}
export function JsonDetails({
  data,
  label = "Détails",
}: {
  data: any;
  label?: string;
}) {
  return (
    <details>
      <summary>{label}</summary>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}
export function AsyncButton({
  action,
  children,
  className = "",
  disabled = false,
  allowed = true,
}: {
  allowed?: boolean;
  action: () => Promise<any>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  if (!allowed) return null;
  return (
    <button
      type="button"
      className={className}
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true);
        try {
          await action();
        } catch {
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "En cours…" : children}
    </button>
  );
}
