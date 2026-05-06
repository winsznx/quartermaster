/**
 * Fleet registry — CRUD on ~/.zerion/quartermaster/fleet.json.
 *
 * NOT an upstream file. Phase 2 deliverable per PRD §31.3.
 *
 * The registry is an array of SubordinateWallet (PRD §7). Schema validation
 * is enforced on every read and every write so hand-edited corruption shows
 * up at the next CLI invocation, not silently downstream.
 */

import { z } from "zod";

import { SubordinateWallet } from "@quartermaster/shared-schemas";

import { qmPath, readJsonOrDefault, writeJsonAtomic } from "../qm/storage.js";

const FleetFile = z.array(SubordinateWallet);

const PATH = () => qmPath("fleet.json");

/**
 * Load and validate fleet.json. Returns [] when the file does not yet exist.
 * Throws on parse failure or schema mismatch — callers print a friendly error.
 */
export function loadFleet() {
  const data = readJsonOrDefault(PATH(), []);
  return FleetFile.parse(data);
}

/**
 * Persist a fleet array. Validates before writing so a programming error
 * upstream cannot corrupt the file on disk.
 */
export function saveFleet(fleet) {
  const validated = FleetFile.parse(fleet);
  writeJsonAtomic(PATH(), validated);
}

/**
 * Add a wallet. Throws if `id` already exists.
 */
export function addWallet(wallet) {
  const validated = SubordinateWallet.parse(wallet);
  const fleet = loadFleet();
  if (fleet.some((w) => w.id === validated.id)) {
    const err = new Error(`wallet "${validated.id}" already exists in fleet`);
    err.code = "wallet_id_taken";
    throw err;
  }
  fleet.push(validated);
  saveFleet(fleet);
  return validated;
}

/**
 * Remove a wallet by id. Returns true if removed, false if not found.
 */
export function removeWallet(id) {
  const fleet = loadFleet();
  const before = fleet.length;
  const next = fleet.filter((w) => w.id !== id);
  if (next.length === before) return false;
  saveFleet(next);
  return true;
}

/**
 * Lookup by id. Returns undefined if not found.
 */
export function getWallet(id) {
  return loadFleet().find((w) => w.id === id);
}

/**
 * List all wallets, optionally narrowed by `chainId` filter.
 */
export function listWallets({ chainId } = {}) {
  const fleet = loadFleet();
  return chainId ? fleet.filter((w) => w.chainId === chainId) : fleet;
}
