# DEVIATIONS

Every time this codebase deviates from the PRD or from a verified upstream snapshot, the deviation is logged here with date, reason, and follow-up. Per `MASTER_PRD.md` §0.2 this is mandatory — pivots are the protocol output, not failures.

Format per entry:

```
## YYYY-MM-DD — short title

**What deviated:** the specific PRD section / upstream doc / pinned version.
**From:** the original spec.
**To:** the new state.
**Why:** the forcing function.
**Follow-up:** what to revisit, when.
```

---

## 2026-04-30 — Initial scaffold version pins

**What deviated:** PRD §21.2 pinned versions table.

**From:**
- `next` 15.0+
- `pnpm` 9.x
- `recharts` 2.12+
- `lucide-react` latest

**To:**
- `next` 16.2.4 (exact pin) — what `pnpm create next-app@latest` resolved on init
- `pnpm` 9.15.5 (corepack-activated; `packageManager` field)
- `recharts` ^3.8.1 — major version bump from PRD spec; latest stable
- `lucide-react` ^1.14.0 — lucide hit 1.0 since PRD draft

**Why:** PRD §21.2 explicitly notes "starting points. Day 0 verification updates them." The latest stable resolves were chosen on init so the lockfile is reproducible and the FE dev gets current versions on first clone.

**Follow-up:**
- Day 0 — verify `recharts@3` API compatibility with the chart components specified in `FRONTEND_BRIEF.md` (axis style, tooltip style, gridlines). If breaking changes are unworkable, downgrade to `2.x`.
- Day 0 — verify `lucide-react@1.x` icon names against the icon strip referenced in landing copy. If breaking, downgrade to `0.4xx`.
- Update PRD §21.2 to match these pins once verified.
