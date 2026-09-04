# Phase 2H-B2 Focused Verification Note

Focused coverage added for:

- future local Workday values resolving to whole-second RFC3339 instants;
- nonexistent DST local time failing visibly;
- shared physical-stop service aggregation feeding one Google stop duration;
- unknown manual-gig duration blocking before the Google request;
- timing/service fields surviving browser request construction;
- Google-only schedule persistence with deterministic basis;
- basis mismatch removing schedule confidence;
- backup v4 preservation/restore of the Google schedule field;
- Preferred Finish remaining a soft overrun after an accepted Home-By-safe schedule.

Provider/backend B1 coverage remains in `tests/phase-2h-b-backend.test.js` and protects hard Home By, traffic infeasibility, complete schedule identity, and 32/33-stop timeout behavior.

No billed Google request is part of automated verification.
