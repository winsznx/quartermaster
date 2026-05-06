/**
 * `zerion qm tune <policy-name> --<key>=<value>` — alias for
 * `zerion qm policy set <policy-name> --<key>=<value>`. Provided as a
 * separate command because `tune` reads more naturally for the operator
 * adjusting policy thresholds.
 */

import qmPolicy from "./policy.js";

export default async function qmTune(args, flags) {
  return qmPolicy(["set", ...args], flags);
}
