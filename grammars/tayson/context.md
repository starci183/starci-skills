# Tây Sơn frontend grammar

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@grammar` | `grammars/tayson/grammar.json` | file | closed public and CRM fact-to-outcome rules |
| `@facts` | `grammars/tayson/facts.json` | file | closed observable fact catalog |
| `@capsules` | `grammars/tayson/capsules.json` | file | durable behavior and case/template bindings |
| `@rulings` | `grammars/tayson/rulings.json` | file | owner statements with negative boundaries |
| `@master-system` | `grammars/tayson/design-system.json` | file | one Tây Sơn brand system shared by public and CRM surfaces |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | deterministic resolver |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | package, case, hash and template proof |

## Record

This package is the independent UI grammar for the Tây Sơn product family. It covers the public website and the authenticated CRM/CMS in one profile because both are one product and brand, while observable surface facts keep their composition and density distinct.

## Law

1. `TAYSON-GRAMMAR-1` — The verified route selects grammar `tayson` and profile `tayson`; StarCi profiles never stand in for Tây Sơn authority.
2. `TAYSON-GRAMMAR-2` — Public surfaces use the editorial public-site owners; authenticated CRM surfaces use operational shell, collection and form owners.
3. `TAYSON-GRAMMAR-3` — Public and CRM surfaces share one Tây Sơn token topology, logo and green identity without sharing page anatomy.
4. `TAYSON-GRAMMAR-4` — The public website never becomes a member portal, and the CRM is limited to the approved internal administration capabilities.
5. `TAYSON-GRAMMAR-5` — Feature state remains in the owning app Page/Block chain; shared UI packages own no product request state.

## Routing

`apps/web` resolves public facts. `apps/crm` resolves authenticated operational facts. Both may reuse leaves and branches from `packages/ui`, while pages and business blocks stay with their owning app.

## Rules

1. Product identity is shared; surface intent is not.
2. Public editorial typography and CRM operational density are separate outcomes.
3. Permission-aware CRM states are required wherever an operation is role-gated.
4. A new sales, payment, ticket or member-portal behavior requires new business authority before grammar promotion.

## Stops

- The workspace route selects another grammar or profile.
- A public region resolves to a CRM owner or an authenticated CRM region resolves to a public owner.
- A requested CRM capability is absent from business authority.

## Output

Return only selected Tây Sơn facts, outcomes, behavior capsules, templates, principle concerns and the deterministic receipt.
