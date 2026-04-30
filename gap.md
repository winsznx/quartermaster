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
