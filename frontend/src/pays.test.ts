import { test } from "node:test";
import assert from "node:assert/strict";
import { drapeau, paysAvecDrapeau } from "./pays";

test("drapeau à partir d'un code pays", () => {
  assert.equal(drapeau("CI"), "🇨🇮");
  assert.equal(drapeau("fr"), "🇫🇷");
  assert.equal(drapeau("C"), "");
  assert.equal(drapeau("CIV"), "");
  assert.equal(drapeau(""), "");
  assert.equal(drapeau(null), "");
  assert.equal(paysAvecDrapeau("ci"), "🇨🇮 CI");
  assert.equal(paysAvecDrapeau("?"), "?");
});
