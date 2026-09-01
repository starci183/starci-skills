---
name: starci-quality-assure
description: Assure one bounded delivery through quality gates, measured readiness, rule binding, and approved debt handling.
---

# Quality assure

Run the declared quality operator sequence. Operators return typed outcomes; this Skill owns every transition and stops on boundary drift or external blockers.

Generic non-UI missions may use the declared repair/debt path. FE-origin missions are verification-only:
consume the exact final route-issued `fe/visual-fidelity=passed` receipt with unchanged source heads,
forbid writes and external mutation, route inventory findings or rule failure to blocked, and route a
rule PASS directly to delivery proof. No Quality repair or debt operator may run after blind visual PASS.
