import { Problem } from "./problem";

// Contrôle d'une image reçue, équivalent serverless de `transfers.sanitize_photo` (Python).
// Sans bibliothèque native (Pillow, sharp), aucun re-encodage n'est possible : on vérifie le
// type par les octets magiques, la taille et les dimensions lues dans l'en-tête, puis le
// fichier est conservé tel quel et servi avec le type détecté (jamais celui annoncé par le client).
// Le navigateur redimensionne avant envoi (Preparation.tsx), d'où la limite basse de 1 Mo.

export const MAX_PHOTO = 1024 * 1024;
export const MAX_PIXELS = 25_000_000;
// Propriétaires : une personne, un officiel, ou un club (owner_id = nom exact du club, cf. clubName).
export const OWNER_TYPES = new Set(["person", "official", "club"]);
// Le type « logo » est réservé aux clubs, et un club n'a qu'un logo.
export const KINDS = new Set(["portrait", "full", "logo"]);
export const CLUB_NAME_MAX = 80;

// Nom de club tel qu'il sert de clé dans `state.club_logos` : la valeur saisie sur les fiches,
// espaces de bord retirés, 1 à 80 caractères. Lève un Problem 422 sinon.
export function clubName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) throw new Problem("Nom du club obligatoire pour un logo.");
  if (name.length > CLUB_NAME_MAX) throw new Problem(`Nom du club trop long : ${CLUB_NAME_MAX} caractères au maximum.`);
  return name;
}

// Cohérence propriétaire / type : « logo » va avec « club », et seulement avec lui.
export function validOwnerKind(ownerType: string, kind: string): boolean {
  if (!OWNER_TYPES.has(ownerType) || !KINDS.has(kind)) return false;
  return (ownerType === "club") === (kind === "logo");
}

export type ImageInfo = { mime: "image/jpeg" | "image/png" | "image/webp"; width: number; height: number };

const u16be = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const u32be = (b: Uint8Array, i: number) => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
const u16le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);
const u24le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
const u32le = (b: Uint8Array, i: number) => (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

// Dimensions d'un JPEG : premier segment SOF rencontré (C0-C3, C5-C7, C9-CB, CD-CF).
function jpegSize(b: Uint8Array): [number, number] | null {
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    // Marqueurs sans longueur : RSTn, TEM, SOI ; EOI termine sans SOF.
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0xd8) {
      i += 2;
      continue;
    }
    if (marker === 0xd9) return null;
    const length = u16be(b, i + 2);
    if (length < 2) return null;
    const sof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (sof) {
      if (i + 8 >= b.length) return null;
      return [u16be(b, i + 7), u16be(b, i + 5)];
    }
    i += 2 + length;
  }
  return null;
}

function pngSize(b: Uint8Array): [number, number] | null {
  if (b.length < 24 || ascii(b, 12, 4) !== "IHDR") return null;
  return [u32be(b, 16), u32be(b, 20)];
}

// WEBP : premier chunk VP8 (avec perte), VP8L (sans perte) ou VP8X (étendu).
function webpSize(b: Uint8Array): [number, number] | null {
  if (b.length < 30) return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8 ") {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return [u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff];
  }
  if (chunk === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const bits = u32le(b, 21);
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
  }
  if (chunk === "VP8X") return [u24le(b, 24) + 1, u24le(b, 27) + 1];
  return null;
}

// Type réel d'après les octets magiques ; null si ce n'est pas une image acceptée.
export function detectImage(b: Uint8Array): ImageInfo["mime"] | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  return null;
}

// Contrôle complet : type, taille, dimensions. Lève un Problem 413 (trop lourd) ou 422 (refusé).
export function inspectImage(b: Uint8Array): ImageInfo {
  if (b.length > MAX_PHOTO) throw new Problem("Photo trop volumineuse : 1 Mo au maximum après réduction par le navigateur.", 413);
  const mime = detectImage(b);
  if (!mime) throw new Problem("Photo refusée : seuls les fichiers JPEG, PNG ou WEBP sont acceptés (le contenu du fichier est vérifié, pas son nom).");
  const size = mime === "image/jpeg" ? jpegSize(b) : mime === "image/png" ? pngSize(b) : webpSize(b);
  if (!size || size[0] <= 0 || size[1] <= 0) throw new Problem("Photo invalide : en-tête d'image illisible.");
  const [width, height] = size;
  if (width * height > MAX_PIXELS) throw new Problem("Photo non supportée : dimensions excessives (25 millions de pixels au maximum).");
  return { mime, width, height };
}

// En-têtes de service : une photo privée n'est jamais mise en cache, une photo approuvée brièvement.
export function photoHeaders(mime: string, approved: boolean): Record<string, string> {
  return {
    "Content-Type": mime,
    "Content-Disposition": "inline",
    "Cache-Control": approved ? "private, max-age=300" : "private, no-store",
  };
}
