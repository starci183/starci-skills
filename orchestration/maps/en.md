---
title: Orchestration phase-map router
---

# Orchestration phase-map router

## LOADS

None.

## Routes

Resolve the selected physical skill through `orchestration/profiles.json`, then load exactly one phase-map record.

| Map | Selected skills | Target |
|---|---|---|
| Frontend design | Layout, Block and Layout Refactor | `orchestration/frontend/en.md` |
| Capability pipelines | Every other StarCi capability | `orchestration/capabilities/en.md` |

Absence from the machine registry is a stop. A skill does not fall back to an approximate map.
