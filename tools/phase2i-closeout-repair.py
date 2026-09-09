from pathlib import Path
import subprocess

BASE = "de7d63909268f6bac770f671bad15991ae9fb954"
ROADMAP = Path("docs/FIELD_WORK_EXPANSION_PLAN.md")

# Restore the complete roadmap from the exact final Phase 2I runtime merge.
original = subprocess.check_output(
    ["git", "show", f"{BASE}:docs/FIELD_WORK_EXPANSION_PLAN.md"],
    text=True,
)

old_header = (
    "**Status:** IN PROGRESS — PHASE 2 PRODUCTION-VALIDATED / PHASE 2F-2K "
    "ROUTE-PLANNER CORE PLANNED / ROUTE-PLANNER PRODUCT AUDIT INCORPORATED / "
    "PHASE 3 DESIGN AUDIT STARTED  \n"
    "**Updated:** 2026-09-02  "
)
new_header = (
    "**Status:** IN PROGRESS — PHASE 2I MULTI-DAY ROUTE PLANS COMPLETE / "
    "PHASE 2J NEXT / PHASE 3 DESIGN AUDIT STARTED  \n"
    "**Updated:** 2026-09-08  "
)
if original.count(old_header) != 1:
    raise SystemExit("Expected roadmap header anchor exactly once")
text = original.replace(old_header, new_header, 1)

phase2j_anchor = "\n### Phase 2J — Day-Aware Workbook Return and Print\n"
status = (
    "\n**Current status — 2026-09-08:** Complete. Phase 2I-A through 2I-D are "
    "merged and published. The final runtime is "
    "`de7d63909268f6bac770f671bad15991ae9fb954`. Route-history v7 / backup v5, "
    "multi-day Day management, local assignment, per-Day Workday state, manual "
    "move/lock, and active-plan completion/replacement are all in the published "
    "app. The final coherent deployed-artifact closeout smoke passed with no "
    "completed-work resurrection, no pending-work loss, and the five-page "
    "desktop/phone planner boundary preserved. See "
    "`docs/PHASE_2I_MULTI_DAY_ROUTE_PLAN_CLOSEOUT_2026-09-08.md`.\n"
)
if text.count(phase2j_anchor) != 1:
    raise SystemExit("Expected Phase 2J anchor exactly once")
text = text.replace(phase2j_anchor, status + phase2j_anchor, 1)
ROADMAP.write_text(text)

# The repaired roadmap must be the full file, not another accidental truncation.
if ROADMAP.stat().st_size < 45000:
    raise SystemExit(f"Roadmap unexpectedly short: {ROADMAP.stat().st_size} bytes")

# One-use helper/workflow must not remain in the PR tree.
Path("tools/phase2i-closeout-repair.py").unlink(missing_ok=True)
Path(".github/workflows/phase2i-closeout-repair.yml").unlink(missing_ok=True)
