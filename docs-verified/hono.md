---
source: https://github.com/honojs/hono/blob/v4.12.17/README.md
raw_url: https://raw.githubusercontent.com/honojs/hono/v4.12.17/README.md
verified_at: 2026-05-06
verified_by: winsznx (Claude Code, Opus 4.7 — Phase 4)
upstream_tag: v4.12.17
upstream_commit: ff2b3d31df1be35f7d597a95dd3369402b6e87f2
content_sha256: cfb0dae7ba7cd76a0451c901ede341c4e4878f98d1bee04875e7c6b8e51f029d
bytes: 3639
lines: 85
---

# hono v4 — verification notes

## Pinned versions

- `hono@4.12.17` (router + middleware)
- `@hono/node-server@2.0.1` (Node adapter — Hono itself runs natively only on the Web standard `Request`/`Response`; this adapter bridges to `node:http`)

Pinned exactly (no caret) in `cli/package.json` per Phase 4 daemon dependency add.

## Why v4

PRD §21.2 starting point was `hono 4.x`. Latest 4.x as of 2026-05-06 is `4.12.17`. v3 -> v4 happened in 2024; current production docs assume v4. No version drift to log — we are inside the spec range.

## Surface we use

- `new Hono()` — app constructor
- `app.get(path, handler)` — GET route
- `c.json(value, status?)` — typed JSON response
- `c.req.param(name)` — path params
- `c.req.query(name)` — query params
- `import { cors } from "hono/cors"` — CORS middleware
- `import { streamSSE } from "hono/streaming"` — SSE helper
- `serve({ fetch: app.fetch, port, hostname })` from `@hono/node-server` — Node bind

## CORS preflight + SSE behaviour

The default `cors()` middleware handles `OPTIONS` preflight automatically. For SSE (`text/event-stream`), Hono's `streamSSE` keeps the connection open and writes `data: {...}\n\n` frames. CORS preflight applies to the initial `EventSource` request; the long-lived stream itself is not re-preflighted.

For Phase 4 we bind the daemon to `127.0.0.1:7402` ONLY (per PRD §10.1). CORS is wide-open for `127.0.0.1`/`localhost` dashboard origins via:

```js
app.use("*", cors({ origin: ["http://127.0.0.1:3001", "http://localhost:3001"] }));
```

Phase 6 widens this to the Vercel dashboard origin once `NEXT_PUBLIC_DAEMON_URL` points at Railway.

## Behaviours we explicitly rely on

1. `serve({ hostname: "127.0.0.1" })` binds ONLY to loopback — verified at smoke-test time.
2. `app.fetch` is a pure function `(Request) => Promise<Response>` — lets HTTP-server tests assert response shapes without binding a port.
3. `streamSSE` flushes on each `await stream.writeSSE({ data, event })`.

## When to revisit

- Before each minor bump (4.13+): re-snapshot.
- CORS expansion in Phase 6 — update the origin allowlist to include the Vercel dashboard domain.
