// Erreur métier ou d'habilitation, rendue en JSON {detail} avec son code HTTP.
// Équivalent de `auth.Problem` du backend Python : même message, même statut.
export class Problem extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
    this.name = "Problem";
  }
}

// Erreur du moteur sportif pur (équivalent de `domain.DomainError`), rendue en 422.
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
