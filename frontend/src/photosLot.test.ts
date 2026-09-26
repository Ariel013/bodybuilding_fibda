import { test } from "node:test";
import assert from "node:assert/strict";
import { reconnaitrePhoto } from "./photosLot";

const carnet = {
  people: [
    { id: "p1", first_name: "Aïcha", last_name: "Koné" },
    { id: "p2", first_name: "Jean-Marc", last_name: "N'Guessan" },
  ],
  entries: [{ id: "e1", person_id: "p1", bib: 12 }],
} as any;
const f = (name: string) => new File([new Uint8Array([1])], name, { type: "image/jpeg" });

test("import en lot : dossard, nom (accents, ordre, ponctuation), plein pied, non reconnu", () => {
  assert.equal(reconnaitrePhoto(f("12.jpg"), carnet).owner?.id, "p1");
  assert.equal(reconnaitrePhoto(f("N°12 plein.JPG"), carnet).kind, "full");
  assert.equal(reconnaitrePhoto(f("12-portrait.png"), carnet).kind, "portrait");
  assert.equal(reconnaitrePhoto(f("13.jpg"), carnet).owner, null);
  assert.equal(reconnaitrePhoto(f("aicha kone.jpg"), carnet).owner?.id, "p1");
  assert.equal(reconnaitrePhoto(f("Koné Aïcha.jpeg"), carnet).owner?.id, "p1");
  assert.equal(reconnaitrePhoto(f("jean marc n guessan-full.webp"), carnet).owner?.id, "p2");
  assert.equal(reconnaitrePhoto(f("jean marc n guessan-full.webp"), carnet).kind, "full");
  assert.equal(reconnaitrePhoto(f("inconnu.jpg"), carnet).owner, null);
  assert.equal(reconnaitrePhoto(f("120.jpg"), carnet).motif, "dossard 120 inconnu");
});
