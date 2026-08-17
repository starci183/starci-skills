---
name: starci-docs-publish
description: Publish the trust tree's docs site as a static build, and keep that build portable — no local checkout, no machine path, no workspace route required. Use when wiring or repairing a host such as Netlify, when a deploy fails on a machine that is not the author's, or before pointing a domain at the site. Writes the site's build config, never the trust records.
---

# starci-docs-publish

Read [`../skill-shape/en.md`](../skill-shape/en.md) first.

The docs site is **generated from the records**, so publishing it is a build question, not a writing
question. This skill owns the build config and the host's fields. It never edits a record to make a
build pass — a record that only renders on one machine is the defect, and moving it is not the fix.

## The law this skill exists to protect

**A build that needs the author's machine is not a build.** The site must build from a clean clone of
this repository and nothing else: no sibling checkout, no absolute path, no workspace route, no
generated directory expected to already exist.

Every dependency on something outside the clone is either removed, or made **optional with a visible
fallback**. Optional-and-silent is the failure mode to avoid: a build that quietly drops the theme
still publishes, and nobody learns that it did.

## PROCESS

### 1 — Print CONTEXT

`Phase` is `plan`, then `review`, then `apply`. `Touching` is the site's build config and the host
settings — never a trust record, never a target repository.

### 2 — Prove the build is portable, before touching the host

Read the site's scripts and every path they resolve, then answer one question per dependency: **does a
clean clone have this?**

| Dependency | Clean clone has it? | If not |
|---|---|---|
| the trust records | yes — they are in the repo | — |
| generated `content/` | no, and it must stay ignored | the build regenerates it; that is correct |
| a sibling frontend checkout | **no** | **remove the step** — see below |
| a workspace route file | **no** | the same; a route is machine-local by law |
| a package from `node_modules` | yes, after install | — |

**This tree is shared across sources, so a dependency on one product's repository is not a portability
bug to soften — it is a category error.** Making such a step optional keeps the coupling and hides it:
the site then renders one way on the author's machine and another way everywhere else, and the
difference is a product nobody else uses. Delete the step, delete what only it fed, and let the site
depend on the records and its own packages.

The test that decides it: would this step mean anything for a **second** product using this tree? If
not, it does not belong here, whether or not it can be made to fail quietly.

### 3 — Simulate the clean clone

Do not reason about it — reproduce it. Clone or copy the repository to a scratch directory, install,
build, and watch it fail there rather than in the host's log:

```bash
git clone <repo> /tmp/clean && cd /tmp/clean/docs && npm ci && npm run build
```

The host is the worst place to discover this: its log is slower to read, its cache confuses the second
attempt, and a red deploy is visible to anyone the link was shared with.

### 4 — Write the build config into the repository

Host fields entered by hand are invisible to the next person and unversioned. Put the real values in a
config file committed to the repo, and keep the host's fields as thin as the host allows.

State the base directory, the build command and the publish directory explicitly, and pin the runtime
version — a site that builds on the author's Node and not on the host's default is the same defect in a
different costume.

### 5 — Review the boundary with the owner

Publishing makes the tree readable by anyone with the link. Before the first deploy, confirm:

- what becomes public — every record, every schema, the whole history in the repository;
- that no machine path, route value or secret is in the published tree;
- whether deploy logs are public, since a log prints paths and command output.

This is one approval, and it is not implied by "wire up the host".

### 6 — Apply, then verify from outside

Deploy, then check the published URL rather than the local one: the home page routes, a deep record
renders, both language records resolve, and the search index loads. A site that works locally and 404s
on a nested route is the normal outcome of a wrong publish directory.

### 7 — Close the phase

Append the workflow and print the six tables. `WARNINGS` names anything the build skipped, with the
consequence — a skipped theme is a real difference between what the author sees and what a reader sees.

## Stops

- The build needs a path outside the clone and the step cannot be made optional → stop; that is a site
  architecture change, not a host setting.
- A record would have to change to make the build pass → stop; return it to the tree's owner.
- The published tree would contain a machine path, a route value or a secret → stop; publishing is
  irreversible in practice, because a link can already have been shared.
- The host builds green but a nested route 404s → the publish directory is wrong; fix it before calling
  it done.

## OUTPUT

The six tables from the skill shape, in order. `CHANGES` names the build config paths and the host
settings changed; `OWED` names any verification that ran only locally.
