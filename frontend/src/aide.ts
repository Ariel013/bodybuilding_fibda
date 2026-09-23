// Parseur du mode d'emploi (docs/MODE-D-EMPLOI.md) — logique pure, sans React ni bibliothèque.
// Sous-ensemble Markdown reconnu : titres `##`/`###`, paragraphes, listes `- `, listes `1. `,
// gras `**…**`. Tout le reste est rendu comme texte brut : jamais d'injection HTML.

export type Run = { text: string; strong: boolean };
export type Block =
  | { type: "heading3"; text: string; runs: Run[] }
  | { type: "paragraph"; text: string; runs: Run[] }
  | { type: "list"; items: Run[][] }
  | { type: "ordered"; items: Run[][] };
export type Section = {
  /** Identifiant stable pour le sommaire (dérivé du titre). */
  id: string;
  title: string;
  /** Identifiants de rôles (`chief`, `judge`…) ou `["tous"]`. L'intro vaut pour tous. */
  roles: string[];
  intro: boolean;
  blocks: Block[];
};

export const TOUS = "tous";

export function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Découpe une ligne en segments texte / gras. Les astérisques orphelins restent du texte. */
export function parseInline(text: string): Run[] {
  const runs: Run[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last)
      runs.push({ text: text.slice(last, m.index), strong: false });
    runs.push({ text: m[1], strong: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), strong: false });
  return runs;
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) {
      const text = paragraph.join(" ");
      blocks.push({ type: "paragraph", text, runs: parseInline(text) });
      paragraph = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (line.startsWith("### ")) {
      flush();
      const text = line.slice(4).trim();
      blocks.push({ type: "heading3", text, runs: parseInline(text) });
      continue;
    }
    const bullet = /^- (.*)$/.exec(line);
    const numbered = /^\d+\. (.*)$/.exec(line);
    if (bullet || numbered) {
      flush();
      const type = bullet ? "list" : "ordered";
      const item = parseInline((bullet || numbered)![1].trim());
      const previous = blocks.at(-1);
      if (previous && previous.type === type) previous.items.push(item);
      else blocks.push({ type, items: [item] });
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

/**
 * Lit le manuel complet. La première section (`intro: true`) porte le titre `#` et le texte
 * situé avant le premier `##`. Chaque `## Profil : …` ou `## Tous les profils` devient une
 * section dont la ligne suivante `Rôles : a, b` donne les rôles.
 */
export function parseManuel(markdown: string): Section[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: Section[] = [];
  let title = "Mode d'emploi";
  let current: { title: string; lines: string[] } | null = null;
  const introLines: string[] = [];
  const close = () => {
    if (!current) return;
    const body = [...current.lines];
    let roles: string[] = [];
    const first = body.find((l) => l.trim());
    const rolesMatch = first && /^Rôles\s*:\s*(.+)$/.exec(first.trim());
    if (rolesMatch) {
      roles = rolesMatch[1]
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      body.splice(body.indexOf(first!), 1);
    }
    sections.push({
      id: slug(current.title),
      title: current.title,
      roles,
      intro: false,
      blocks: parseBlocks(body),
    });
    current = null;
  };
  for (const line of lines) {
    if (line.startsWith("# ") && !current && !introLines.length) {
      title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith("## ")) {
      close();
      current = { title: line.slice(3).trim(), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
    else introLines.push(line);
  }
  close();
  return [
    {
      id: "introduction",
      title,
      roles: [TOUS],
      intro: true,
      blocks: parseBlocks(introLines),
    },
    ...sections,
  ];
}

/** Libellé court d'une section de profil (« Profil : Juge » → « Juge »). */
export function libelleProfil(section: Section): string {
  return section.title.replace(/^Profil\s*:\s*/, "");
}

/**
 * Garde l'intro, les sections dont un rôle correspond à ceux fournis et « Tous les profils ».
 * Sans rôle connu (écran de connexion), seules l'intro et les sections « tous » restent.
 */
export function sectionsPourRoles(
  sections: Section[],
  roles: string[],
): Section[] {
  return sections.filter(
    (s) =>
      s.intro ||
      s.roles.includes(TOUS) ||
      s.roles.some((r) => roles.includes(r)),
  );
}
