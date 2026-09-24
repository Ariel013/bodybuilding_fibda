// Drapeau d'un code pays ISO alpha-2 : deux lettres régionales Unicode (🇨🇮 pour CI).
// Un code invalide ne donne rien : jamais d'erreur d'affichage sur une saisie incomplète.
export function drapeau(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "";
  return [...code.toUpperCase()].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}

// « 🇨🇮 CI » ; le code seul si le drapeau est vide.
export function paysAvecDrapeau(code: string | null | undefined): string {
  const f = drapeau(code);
  return f ? `${f} ${code!.toUpperCase()}` : (code ?? "");
}
