---
name: starci-deploy-vps
description: Stands up the single-droplet VPS flow and wires it so a push to main ships — the StarCi Academy shape, where a self-hosted GitHub Actions runner living on the box rebuilds and restarts the app with `docker compose up --build` on every push to main, its backing services stood up separately by Terraform-over-SSH. Given the project's secrets in the environment (the VPS host, user and password; a Cloudflare token; a GitHub token), it prepares the box over SSH, points the app's domain through Cloudflare, generates and pushes the deploy workflow, and injects every secret that workflow needs into the repo's GitHub Actions secrets — so the pipeline is complete and the next push to main deploys. Reach for it when the ask is to stand up or ship the VPS flow: "deploy academy lên vps", "cấp vps rồi deploy", "provision the vps", "wire ci/cd cho vps", "push là tự deploy", "set up vps deploy", "ship the backend to the droplet", "đưa backend lên vps". Not for Kubernetes — a DOKS cluster or a helm rollout is `starci-deploy-k8s`; and not for registering where the source or its secrets live, which is `starci-setup-workspace`.
---

# Deploy to a VPS

The shape this skill lands is the one StarCi Academy already runs: the app is a single `docker
compose` service on one droplet, and a **self-hosted GitHub Actions runner living on that droplet**
rebuilds and restarts it on every push to `main` — no registry, the image is built on the box. The
backing services (databases, queues) are a separate Terraform-over-SSH lifecycle and are not this
skill's job. This skill's job is to take a machine and a repo from nothing to *that* state, reading
every credential from the environment and writing none of them to disk.

It presents nothing and runs the shared hooks — [`pre/resolve-workspace`](../hooks/pre/resolve-workspace.md)
before it touches anything, and [`post/record-correction`](../hooks/post/record-correction.md) if the
result is wrong.

## 1. Resolve the source and the secrets

Resolve the back-end repo and the secrets from the environment — the values live only there
(`starci-setup-workspace` explains the model):

```bash
BE=$(node .claude/scripts/workspace/read-workspace-context.mjs be.path)
HOST=$(node .claude/scripts/workspace/read-workspace-context.mjs secret.VPS_HOST)
USER=$(node .claude/scripts/workspace/read-workspace-context.mjs secret.VPS_USER)
```

The secrets this flow needs — `VPS_HOST`, `VPS_USER`, `VPS_PASS`, `CLOUDFLARE_TOKEN`, `GITHUB_TOKEN`,
plus the app's own runtime secrets — are declared once with `register-workspace-source.mjs --secrets`
and set into the shell with `.claude/scripts/workspace/set-secrets.sh` (or `.ps1`). A secret that is
not set exits non-zero and names the env var to set; honour that rather than deploying half-configured.

## 2. Prepare the box over SSH

The droplet is **pre-existing** — its address is `VPS_HOST`, and this skill does not create it. Over
SSH it makes the box ready: install Docker and the compose plugin if absent, register a **self-hosted
GitHub Actions runner** bound to the repo (so the deploy job runs on the box and needs no inbound SSH
of its own), and create the deploy directory the compose file expects.

Authentication is by **password** for now — the `VPS_PASS` secret, fed to `ssh`/`sshpass` from the
environment and never echoed into a command line that a log would capture. (SSH-key auth is a planned
addition; the same skill will prefer a key when one is declared.) Trust the host on first contact with
`StrictHostKeyChecking=accept-new`, not by disabling it.

## 3. Point the domain through Cloudflare

Using `CLOUDFLARE_TOKEN` (a Zone:DNS:Edit token), create or update the DNS record for the app's domain
— an `A` record to `VPS_HOST`, or a tunnel where the box has no public address. This is the piece the
Academy flow configures out of band today; the skill brings it into the same one-shot.

## 4. Wire the pipeline so a push ships

Generate `.github/workflows/deploy.yml` in the repo — triggered on push to `main`, path-filtered to
ignore docs and scratch, running on the self-hosted runner and doing the one thing the box needs:

```yaml
docker compose -f apps/core/vps-compose.yaml up --build -d
```

Then push it, and inject every declared secret into the repo's GitHub Actions secrets so the workflow
has what it reads — the value flowing straight from the environment into `gh`, never through a file or
a log:

```bash
for VAR in $(node .claude/scripts/workspace/read-workspace-context.mjs --secrets); do
    NAME=${VAR#*_}                                   # strip the <PROJECT>_ prefix
    gh secret set "$NAME" --repo "$REPO" \
        --body "$(node .claude/scripts/workspace/read-workspace-context.mjs secret.$NAME)"
done
```

`GITHUB_TOKEN` is what authenticates `gh`; set it in the environment, never on a command line. Non-secret
configuration (ports, CORS origins, cookie domain) goes in as repo **variables** rather than secrets.

## 5. Verify, and record what did not fit

Push a trivial commit to `main` (or `gh workflow run "Deploy"`) and watch the run: the app should come
up and answer on its domain. What could not be finished in this pass — a backing service the ops
Terraform still owns, a DNS record awaiting propagation, a key-auth migration deferred — is written down
through `starci-record-debt`, not left in someone's memory.

## The secrets it reads (env-only)

| Secret | What it is for |
|---|---|
| `VPS_HOST` · `VPS_USER` · `VPS_PASS` | reach and log into the droplet over SSH |
| `CLOUDFLARE_TOKEN` | point the app's domain (DNS record or tunnel) |
| `GITHUB_TOKEN` | push the workflow and set the repo's Actions secrets |
| `CLAUDE_CODE_OAUTH_TOKEN` | so the backend's AI-feature test harness runs in CI on Claude Code OAuth |
| the app's own runtime secrets | injected into Actions, read by the container at run time |

Every value lives in an environment variable, resolved through
`.claude/scripts/workspace/read-workspace-context.mjs secret.<NAME>` — never in `workspace.json`, never
in the repo, because this skill set is public.

## Files

| Path | What it is |
|---|---|
| `scripts/workspace/read-workspace-context.mjs` | resolves paths and secrets (from env) |
| `scripts/workspace/set-secrets.sh` · `.ps1` | prompt for the declared secrets, export into the shell |
| `skills/starci-setup-workspace/SKILL.md` | declares which secrets a project needs |
| `skills/starci-deploy-k8s/SKILL.md` | the other flow — Kubernetes rather than a droplet |
| `test.mjs` | run after any change: `node .claude/skills/starci-deploy-vps/test.mjs` |
