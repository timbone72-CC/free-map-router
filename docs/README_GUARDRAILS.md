# Guardrails Quick Start

Before changing application behavior:

1. Read `CONTRACT.md`, `CHANGE_CONTROL_CONTRACT.md`, and the relevant
   `REGRESSION_CHECKLIST.md` section.
2. Classify the work as Level 1, Level 2, or Level 3.
3. Work on a branch, not directly on `main`.
4. Keep the scope inside the owning module.
5. Let CI run the full automated suite.
6. Complete only the smoke checks required by the risk level and affected
   surface.

The user's approved scope counts once. Ask again only when the scope expands,
assumptions fail, or Level 3 pre-merge approval is required.
