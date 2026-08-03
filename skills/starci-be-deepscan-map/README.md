# starci-be-deepscan-map — why it exists

Two skills already grade the backend against canon: `starci-be-cannon-plan` audits a module and
returns a report, `starci-be-cannon-apply` lands the fix. Neither does the two things this one adds:

1. **A whole-tree pass, domain by domain.** The cannon skills work on what you point them at. This
   one is built to sweep all thirty business domains, partitioned by file count across a fan-out of
   agents, so the drift across the *whole* backend is on one table.

2. **A map for the front end.** The output is not only a findings ledger — it is a `business.md` per
   domain: the states, transitions and invariants behind the API, written for a front-end reader who
   will never open the backend. That map is the thing the FE asked for, and no audit skill produced
   it before.

It is read-only, like the plan skill — it writes `.artifacts/states/`, never `src/`. The repair is a
separate, approved act. See `SKILL.md` for the routine, the seven grading axes, and the fan-out rule.

The canon standard it grades against is `canon/be/` — including the `authorization.md` shelf added
alongside this skill, which spells the guard-on-every-mutation and owner-in-the-query rules the
`security` and `gate-middleware` axes lean on.
