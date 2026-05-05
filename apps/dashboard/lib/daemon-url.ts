/**
 * Public daemon URL — base URL for the QM daemon HTTP API (PRD §22.3).
 *
 * Default `http://127.0.0.1:7402` is the daemon when run on the same machine
 * as the dashboard (the production self-host story per README "Self-host").
 *
 * For the public Vercel-hosted demo, set `NEXT_PUBLIC_DAEMON_URL` in the
 * dashboard's Vercel project to the Railway-deployed demo daemon URL. The
 * browser fetches directly, so the daemon must enable CORS for the dashboard
 * origin.
 *
 * `NEXT_PUBLIC_` prefix is required — Next.js inlines this at build time so
 * client components can read it.
 */
export const DAEMON_URL: string =
  process.env.NEXT_PUBLIC_DAEMON_URL ?? "http://127.0.0.1:7402";
