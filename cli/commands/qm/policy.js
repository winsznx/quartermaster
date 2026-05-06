/**
 * `zerion qm policy {get|set} <name> [--<key>=<value>]`
 *
 * Reads/writes ~/.zerion/quartermaster/policies.json — the per-policy config
 * overrides consumed by the layer-1 dispatcher. Phase 4 implementation:
 * minimal get/set with JSON-typed values. The orchestrator merges this file
 * into PolicyContext.policyConfig at decider time.
 */

import { z } from "zod";

import { print, printError } from "../../cli/lib/util/output.js";

import { qmPath, readJsonOrDefault, writeJsonAtomic } from "../../lib/qm/storage.js";

const PoliciesFile = z.record(z.string(), z.record(z.string(), z.unknown()));

function policiesPath() {
  return qmPath("policies.json");
}

function loadPolicies() {
  return PoliciesFile.parse(readJsonOrDefault(policiesPath(), {}));
}

function savePolicies(value) {
  writeJsonAtomic(policiesPath(), PoliciesFile.parse(value));
}

export default async function qmPolicy(args, flags) {
  const [verb, name] = args;
  if (verb === "get") {
    if (!name) {
      print(loadPolicies());
      return;
    }
    const cfg = loadPolicies()[name] ?? {};
    print({ name, config: cfg });
    return;
  }

  if (verb === "set") {
    if (!name) {
      printError("missing_args", "Usage: zerion qm policy set <name> --<key>=<value> [...]");
      process.exit(1);
    }
    const updates = {};
    for (const [key, value] of Object.entries(flags)) {
      if (key === "name") continue;
      // Coerce numeric strings; leave others as-is.
      const num = Number(value);
      updates[key] = !Number.isNaN(num) && /^-?[\d.]+$/.test(String(value)) ? num : value;
    }
    const all = loadPolicies();
    all[name] = { ...(all[name] ?? {}), ...updates };
    savePolicies(all);
    print({ updated: name, config: all[name] });
    return;
  }

  printError("usage", "Usage: zerion qm policy {get|set} <name> [--<key>=<value>]");
  process.exit(1);
}
