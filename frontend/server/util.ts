import { randomUUID } from "node:crypto";
import { Problem } from "./problem";

export const uid = (): string => randomUUID();

// Sérialisation compacte, sans espace, comme `store.dump` côté Python.
export function dump(value: unknown): string {
  return JSON.stringify(value);
}

export function deepcopy<T>(value: T): T {
  return structuredClone(value);
}

export type WithId = { id: string; [key: string]: any };

// `workflow.find` : élément par identifiant, 404 sinon.
export function find<T extends WithId>(items: T[], ident: string | null | undefined, label = "Élément"): T {
  const item = items.find((x) => x.id === ident);
  if (item === undefined) throw new Problem(label + " introuvable.", 404);
  return item;
}

// Horloge en secondes Unix (flottant), comme `time.time()` côté Python.
export type Clock = () => number;
export const wallClock: Clock = () => Date.now() / 1000;
