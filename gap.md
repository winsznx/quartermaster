# GAP

Every gap, ambiguity, contradiction, or "this isn't in the brief / PRD" the FE dev (or any contributor) hits — log it here. Don't try to fix the PRD. Don't drift. The PRD stays the source of truth; this file is the running list of *delta between PRD and reality*.

The repo owner reviews this file when planning the next round of PRD updates or when answering questions in DM.

## Format per entry

```markdown
## YYYY-MM-DD — short title

**Where:** the file / page / route you were working on
**PRD reference (if any):** §X.Y or N/A
**Brief reference (if any):** section title or N/A

**The gap:** one paragraph, concrete. What you needed and couldn't find / what conflicts.

**What you did anyway:** the temporary call you made (with reason).

**What needs to happen:** PRD update / brief update / clarification from owner / new spec.

**Blocking?** Yes / No (does this stop your next PR or can you keep going)
```

## Rules

1. **Do NOT modify `MASTER_PRD.md` or `FRONTEND_BRIEF.md`** to "fix" gaps. Log here, get a decision, then those documents change.
2. **Make a temporary call and keep going** when not blocking — don't wait. Document the call.
3. **If blocking**, stop, log the gap, ping the repo owner.
4. **One entry per distinct gap.** Don't bundle.
5. **Close entries** by noting the resolution at the bottom of the entry (don't delete) once a PRD/brief update lands.

---

<!-- New entries below. Most recent first. -->

## 2026-05-02 — Port 3000 occupied

**Where:** apps/landing
**PRD reference (if any):** N/A
**Brief reference (if any):** Phase A Task 2

**The gap:** Port 3000 is occupied by process 2076 (likely another project). PRD/Brief implies landing should run on 3000.

**What you did anyway:** Changed landing `dev` script to use port 3002.

**What needs to happen:** User to confirm if port 3000 can be freed or if 3002 is acceptable for landing.

**Blocking?** No

## 2026-05-02 — Contrast sanity check

**Where:** apps/dashboard/app/globals.css
**PRD reference (if any):** N/A
**Brief reference (if any):** Contrast notes

**The gap:** Oxblood `#8B2A26` on bg `#0B0D0E` measures ~3.1:1, failing AA for body text.

**What you did anyway:** Ensured it's only used as `bg-danger` with white text (e.g., in badges/pills) which hits ~5.9:1 and passes AA. No component uses it as text foreground.

**What needs to happen:** Nothing, as long as it's restricted to filled backgrounds.

**Blocking?** No
