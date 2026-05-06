/**
 * Treasury registry — CRUD on ~/.zerion/quartermaster/treasury.json.
 *
 * NOT an upstream file. Phase 2 deliverable per PRD §31.3.
 *
 * The registry is an array of TreasurySource (PRD §7). Used by the decider
 * (Phase 4) to pick the lowest-APY source per `yield-curve-preservation`.
 */

import { z } from "zod";

import { TreasurySource } from "@quartermaster/shared-schemas";

import { qmPath, readJsonOrDefault, writeJsonAtomic } from "../qm/storage.js";

const TreasuryFile = z.array(TreasurySource);

const PATH = () => qmPath("treasury.json");

/**
 * Load and validate treasury.json. Returns [] when the file does not yet exist.
 */
export function loadSources() {
  const data = readJsonOrDefault(PATH(), []);
  return TreasuryFile.parse(data);
}

export function saveSources(sources) {
  const validated = TreasuryFile.parse(sources);
  writeJsonAtomic(PATH(), validated);
}

export function addSource(source) {
  const validated = TreasurySource.parse(source);
  const sources = loadSources();
  if (sources.some((s) => s.id === validated.id)) {
    const err = new Error(`treasury source "${validated.id}" already exists`);
    err.code = "source_id_taken";
    throw err;
  }
  sources.push(validated);
  saveSources(sources);
  return validated;
}

export function getSource(id) {
  return loadSources().find((s) => s.id === id);
}

export function listSources() {
  return loadSources();
}
