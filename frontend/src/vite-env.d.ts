// Déclarations des imports Vite non couverts par les types Node.
// Le mode d'emploi est importé en texte brut depuis src/aide/MODE-D-EMPLOI.md (docs/MODE-D-EMPLOI.md est un lien symbolique).
declare module "*.md?raw" {
  const content: string;
  export default content;
}
