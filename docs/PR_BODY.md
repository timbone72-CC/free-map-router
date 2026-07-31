## Level 2 — balanced repository guardrail upgrade

This change adds app-wide, risk-scaled change control without changing runtime
application files.

- Low-risk work stays light.
- Normal features use focused tests and affected smoke checks.
- High-risk data, permissions, routing, and deployment work receives stronger
  impact and rollback controls.
- User approval counts once unless scope changes.
- CI runs the full test and syntax suite.

Rollback: `71c7afcfcf82a54dcd5080e04ec0652b534a9b4f`.
