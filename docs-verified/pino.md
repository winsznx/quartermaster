---
source: https://github.com/pinojs/pino/blob/v10.3.1/README.md
raw_url: https://raw.githubusercontent.com/pinojs/pino/v10.3.1/README.md
verified_at: 2026-05-06
verified_by: winsznx (Claude Code, Opus 4.7 — Phase 4)
upstream_tag: v10.3.1
upstream_commit: 6b344980eae3ebed904fc87caf4bba0ab9dbe946
content_sha256: 1f83b2944178fb30ca19d697f1faf35b3e2b462a71b86e8a2b1adf95420fb774
bytes: 4895
lines: 177
---

# pino v10 — verification notes

## Pinned version

`pino@10.3.1` exact (no caret) in `cli/package.json`.

## Drift from PRD §21.2

PRD §21.2 starting point was `pino 9.x`. Latest stable as of 2026-05-06 is `10.3.1`. Major bump. Logged in DEVIATIONS under *Doc-Verification Drift*.

## v9 -> v10 surface differences relevant to our use

We use a minimal subset:
- `pino({ level, base })` — root logger constructor
- `logger.child({ ... })` — bind context
- `logger.{trace,debug,info,warn,error,fatal}(obj, msg?)` — structured log

These exist identically in v9 and v10. v10's main breaking changes are around transports (we don't ship custom transports yet) and the default level for `silent` (we set `level` explicitly). Migration cost ~zero.

## Behaviours we explicitly rely on

1. JSON-line output to stdout by default.
2. `logger.level = "info"` cutoff applied in-process.
3. Structured-first: `log.info({ tickId, walletId }, "tick started")` produces a JSON object with both fields, NOT a printf-style format string.
4. `silent` level disables output (used in tests).

## When to revisit

- Before each minor bump (10.4+): re-snapshot.
- If a transport (file, OpenTelemetry, Loki) is added in Phase 6 — re-verify transport surface against this snapshot.
