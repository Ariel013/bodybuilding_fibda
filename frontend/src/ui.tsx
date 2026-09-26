import { useEffect, useRef, useState, type ReactNode } from "react";
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

/**
 * Menu d'actions replié sous un bouton « … » (PO, 26/09/2026 : les boutons Modifier, Désactiver,
 * Supprimer prenaient trop de place). Les enfants sont les boutons habituels (AsyncButton compris,
 * qui disparaissent d'eux-mêmes quand le rôle ne le permet pas) ; le menu se ferme au clic dehors,
 * à la touche Échap, et dès qu'un bouton du menu est touché.
 */
export function ActionMenu({ label = "Actions", children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dehors = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const touche = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", dehors);
    document.addEventListener("touchstart", dehors);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("touchstart", dehors);
      document.removeEventListener("keydown", touche);
    };
  }, [open]);
  return (
    <div className="action-menu" ref={ref}>
      <button
        type="button"
        className="ghost action-menu-toggle"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        …
      </button>
      {open && (
        <div className="action-menu-items" role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Document imprimable ouvert dans l'application (PO, 26/09/2026 : en PWA installée, un nouvel onglet
 * quitte l'application et perd la session, « ça disparaît »). Le HTML est récupéré avec la session,
 * affiché dans un cadre pleine page, imprimé depuis ce cadre ; « Fermer » revient à l'écran.
 */
export function PrintLink({ href, children, className = "button ghost" }: { href: string; children: ReactNode; className?: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const ouvrir = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(href, { credentials: "same-origin" });
      if (!r.ok) {
        let detail = "Document indisponible (" + r.status + ").";
        try {
          detail = (await r.json()).detail ?? detail;
        } catch {
          /* corps non JSON */
        }
        throw new Error(detail);
      }
      const text = await r.text();
      // Les liens relatifs du document (logo) se résolvent sur l'origine de l'application.
      setHtml(text.replace(/<head>|<meta charset="utf-8">/i, (m) => m + '<base href="' + window.location.origin + '/">'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <a
        className={className}
        href={href}
        onClick={(e) => {
          e.preventDefault();
          void ouvrir();
        }}
      >
        {busy ? "Chargement…" : children}
      </a>
      {error && <small className="danger">{error}</small>}
      {html !== null && (
        <div className="print-overlay" role="dialog" aria-label="Document imprimable">
          <div className="print-bar">
            <button type="button" onClick={() => frame.current?.contentWindow?.print()}>
              Imprimer
            </button>
            <button type="button" className="ghost" onClick={() => setHtml(null)}>
              Fermer
            </button>
          </div>
          <iframe ref={frame} className="print-frame" title="Document" srcDoc={html} />
        </div>
      )}
    </>
  );
}
