---
name: starci-deploy-k8s
description: Stands up or rolls out the Kani flow on Kubernetes — the app repo builds and pushes each service's image on every push to main (self-hosted GitHub Actions, `kani-<svc>:latest`), and the deploy repo (`kani-k8s/terraform/do`) either provisions a fresh DigitalOcean DOKS cluster with everything already on it (cert-manager, Cloudflare DNS, external-secrets, the data services, the kani services themselves via the "service" Helm chart) or rolls a new release onto a cluster that already exists. Reach for it whenever the ask is to ship or to stand the cluster up: "deploy kani lên k8s", "dựng cụm k8s", "terraform apply cụm", "helm upgrade kani", "rollout k8s", "provision doks", "spin up the DOKS cluster", "bring the cluster back up", "push a new image and roll it out", "just redeploy the api service", "cluster's down, provision it again". Not for the VPS flow, a single droplet on docker-compose (starci-deploy-vps), and not for registering where the app repo or the deploy repo lives on this machine (starci-setup-workspace).
---

# Standing up or rolling out Kani's cluster

Two repos do this job, and they do not yet know about each other. `kani` builds an image every
time main moves; `kani-k8s/terraform/do` is the only thing that ever puts an image on a cluster,
and it does that by re-running Terraform, not by watching for a push. ArgoCD and a Jenkins webhook
sit in the deploy repo already, commented out — the wiring for "push, then roll out" exists on
paper and nowhere else. Until that lands, the missing link between the two repos is whoever runs
this skill.

So the first thing this lane does is name which of two very different jobs is being asked for,
because they share a folder and almost nothing else.

## 0. Resolve the project

```bash
node .claude/scripts/workspace/read-workspace-context.mjs
```

Every secret below lives in an environment variable named `<PROJECT>_<NAME>` — this step is what
tells the rest of the run which project's prefix that is, per
`skills/hooks/pre/resolve-workspace.md`. If nothing answers, the machine
has never been pointed at this project: register it first with `starci-setup-workspace`, and
declare every secret this deploy will ask for while you're there —

```bash
node .claude/scripts/workspace/register-workspace-source.mjs \
  --secrets DO_TOKEN,CLOUDFLARE_TOKEN,KUBECONFIG,DOCKER_REGISTRY,DOCKER_USERNAME,DOCKER_PASSWORD,GITHUB_TOKEN,CLAUDE_CODE_OAUTH_TOKEN
```

Reading a secret afterwards never prints its value to a log — it prints bare, meant for `$(...)` or
to be piped straight into another command:

```bash
node .claude/scripts/workspace/read-workspace-context.mjs secret.DO_TOKEN
```

A name missing from the environment exits non-zero and names the exact env var to set. Nothing
below writes a secret's value to disk; the value never leaves the environment it was read from.

## 1. Which of the two jobs is this

| Ask sounds like | Mode | What actually runs |
|---|---|---|
| "the cluster doesn't exist yet", "provision doks", "dựng cụm k8s", first deploy of a new environment | **A — Provision** | `terraform apply` in `kani-k8s/terraform/do` — stands up DOKS and everything on it |
| "just ship this change", "helm upgrade kani", "rollout k8s", the cluster is already up and a service changed | **B — Redeploy** | point `kubectl`/`helm` at the existing cluster, roll one workload |

Provisioning already includes a full deploy — a fresh `terraform apply` installs the platform
pieces and the kani services in the same run. Redeploy exists because re-running the whole
provision for a one-line change in one service is real minutes spent proving nothing changed
everywhere else. Ask, if the phrasing doesn't say which: standing up a new environment, or rolling
a change onto one that's already there.

## 2. What each repo owns

**`kani`** (the app repo) never touches the cluster. `.github/workflows/kani-*.yaml` runs on a
self-hosted runner in the `kani` GitHub environment, and on every push to `main` it logs in with
`DOCKER_REGISTRY`/`DOCKER_USERNAME`/`DOCKER_PASSWORD` and `buildx push`es `kani-<svc>:latest`. Its
whole job ends there — an image sitting in the registry, with nothing pulling it onto anything yet.

**`kani-k8s/terraform/do`** (the deploy repo) is where the cluster comes from and where it is
changed. One `terraform apply` provisions the DOKS cluster itself, cert-manager, the Cloudflare DNS
records, external-secrets, the data services, and the kani services — the last of these through a
`helm_release` per workload pulling the `service` chart from `https://k8s.kanibot.xyz/charts`. The
kubeconfig is not a separate secret you generate by hand: it is derived from the DigitalOcean token
inside that same terraform run, which is why `DO_TOKEN` (plus `CLOUDFLARE_TOKEN` and the platform's
`TF_VAR_*` secrets) is the one real input a fresh cluster needs — everything downstream of the
cluster existing follows from those.

## 3A. Provision — the cluster does not exist

The variable schema for whichever environment you're standing up lives in `variables_*.tf` in that
folder — read it before exporting blind, so you export what this environment actually declares and
nothing invented. `env/*.tfvars` is gitignored; the values it would hold come from the secret
mechanism instead:

```bash
export TF_VAR_digitalocean_token=$(node .claude/scripts/workspace/read-workspace-context.mjs secret.DO_TOKEN)
export TF_VAR_cloudflare_api_token=$(node .claude/scripts/workspace/read-workspace-context.mjs secret.CLOUDFLARE_TOKEN)
# … one export per platform TF_VAR_* the schema declares, each read the same way
```

```bash
cd kani-k8s/terraform/do
terraform init
terraform apply -var-file=env/<env>.tfvars
```

`terraform plan` first when the ask is uncertain about blast radius — a provision run touches DNS
and a live cluster, and a plan costs nothing to read before an apply commits to it.

## 3B. Redeploy — a cluster already there (the common case)

```bash
node .claude/scripts/workspace/read-workspace-context.mjs secret.KUBECONFIG > kubeconfig
export KUBECONFIG="$PWD/kubeconfig"
kubectl config current-context   # confirm it's pointed where you think before touching anything
```

Then either roll the chart, when the release's values changed —

```bash
helm upgrade <svc> service --repo https://k8s.kanibot.xyz/charts -n <namespace> -f charts/repo/service/values-<svc>.yaml
```

— or just pick up the image `kani`'s pipeline already pushed, when only the code changed —

```bash
kubectl rollout restart deployment/<svc> -n <namespace>
kubectl rollout status deployment/<svc> -n <namespace>
```

Delete the local `kubeconfig` file when the run is done; it is a secret value that just touched
disk on purpose for `kubectl` to read, not a thing to leave lying around after.

## 4. Wire the app repo's image build

The push-on-main pipeline in `kani` reads its Docker credentials from repo secrets, not from this
skill set — set them once with `gh secret set`, using `GITHUB_TOKEN` to authenticate the call:

```bash
GH_TOKEN=$(node .claude/scripts/workspace/read-workspace-context.mjs secret.GITHUB_TOKEN) \
  gh secret set DOCKER_REGISTRY --repo <org>/kani --env kani \
  --body "$(node .claude/scripts/workspace/read-workspace-context.mjs secret.DOCKER_REGISTRY)"
# repeat for DOCKER_USERNAME, DOCKER_PASSWORD
```

Each value is piped straight from the read into `gh secret set`'s stdin/`--body` — it never sits in
a shell variable you'd have to remember to unset, and it never appears in this skill's own output.

## What this lane refuses

**It does not chain a push to a rollout on its own.** ArgoCD and the Jenkins webhook are commented
out in the deploy repo for a reason nobody has revisited yet; building that wiring because it looks
obvious is a real, separate piece of work, not a step folded silently into a redeploy. If it's
wanted, that's a task to ask for, or debt to record with
`.claude/scripts/record-technical-debt.mjs` — not something this skill invents mid-run.

**It does not guess the environment.** `-var-file=env/<env>.tfvars` names a real file; a provision
run against the wrong one is a wrong cluster with a right-looking apply. Ask, if it isn't already
named in the request.

**It does not write a secret value to disk beyond the one command that needs it there.** The
`kubeconfig` file in 3B is the one deliberate exception, because `kubectl` has no other way to take
it — and it is deleted again once the run is done, not left for the next person to find.

**It does not report a rollout done from the command it ran, alone.** `helm upgrade` and `kubectl
rollout restart` both return before the new pods are actually healthy; `kubectl rollout status`
is what turns "the command exited 0" into "the change is live," and it's part of the job, not an
optional extra.

## Files

| Path | What it is |
|---|---|
| `.claude/scripts/workspace/read-workspace-context.mjs` | resolves the current project and reads a secret's value from its env var |
| `.claude/scripts/workspace/register-workspace-source.mjs` | registers the project and declares which secrets it needs |
| `.claude/scripts/record-technical-debt.mjs` | the ledger for wiring that's deliberately not being built today |
| `kani-k8s/terraform/do/variables_*.tf` | the real schema for the `TF_VAR_*` this environment declares |
| `README.md` | why this skill is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-deploy-k8s/test.mjs` |

## When it is corrected

This is the `skills/hooks/post/record-correction.md` hook. When the person
corrects what this skill just did — the wrong mode was picked, a secret name was wrong, a rollout
was called done before it was actually healthy — record it before you finish: one file under
`corrections/pending/`, in the shape that hook and `corrections/README.md` set out. Do not fix it
silently; the miss returns next session unless it is written down.
