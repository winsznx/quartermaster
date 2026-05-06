/**
 * `zerion qm resume` — remove the paused flag file.
 */

import { unlinkSync } from "node:fs";

import { print, printError } from "../../cli/lib/util/output.js";

import { qmPath } from "../../lib/qm/storage.js";

export default async function qmResume(_args, _flags) {
  try {
    try {
      unlinkSync(qmPath("paused"));
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
    print({ paused: false });
  } catch (err) {
    printError(err.code || "resume_failed", err.message);
    process.exit(1);
  }
}
