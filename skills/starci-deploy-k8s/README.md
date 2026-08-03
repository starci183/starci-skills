---
# starci-deploy-k8s — notes

`SKILL.md` says what to do. This file says why it is shaped this way and what it deliberately
refuses. Read it before changing anything here.

## Why one skill covers two jobs that share almost nothing

Provisioning and redeploying touch the same folder and the same secrets, and a person asking for
one of them often uses the same words for both — "deploy kani", "put this on k8s". Splitting them
into two skills would just move the ambiguity from inside one document to a choice between two
documents, made with less information than the skill itself has once it's actually read the
request. So the split happens at step 1, inside one lane, where "which cluster" and "what changed"
are both already in front of the reader.

What does NOT get merged is the two repos' jobs. `kani` only ever produces an image; `kani-k8s`
is the only thing that ever puts one on a cluster. Keeping that boundary named in `SKILL.md` — not
just implied by which folder a command runs in — is what stops a redeploy from quietly turning into
a half-provision because someone assumed the app repo does more than build.

## Why the kubeconfig auto-derivation gets its own sentence

It would be easy to read DigitalOcean's setup as "get a kubeconfig from somewhere, then deploy" —
two separate credentials to track down. It is not that. The kubeconfig comes out of the same
terraform run that reads `DO_TOKEN`, which means the token is the actual root of trust for
everything downstream, and a redeploy against an existing cluster is really "read the KUBECONFIG
secret someone already derived and saved," not "derive one." Saying this once in `SKILL.md` stops
a future run from re-deriving a kubeconfig it could have just read.

## Why the missing ArgoCD/Jenkins wiring is named instead of quietly worked around

A skill that notices a real gap and just papers over it every time — running an extra `kubectl
apply` here, a webhook curl there — makes that gap invisible in exactly the run where someone might
otherwise have noticed it was worth fixing for real. Naming it in "What this lane refuses" keeps
the fact that image-push and cluster-deploy aren't chained visible to whoever reads this next,
rather than buried inside a step that happens to compensate for it.

## Why secrets are read, piped, and never assigned to a shell variable that outlives the command

The mechanism already guarantees a value never touches disk or this repo — `read-workspace-context.mjs
secret.<NAME>` prints it bare, for exactly one purpose. What this skill adds on top is discipline
about where that bare value goes next: straight into `$(...)`, straight into `--body`, straight into
an `export` that only this shell session holds. The one place a value does land on disk — the
`kubeconfig` file `kubectl` needs to read — is named as the one deliberate exception, with the
instruction to delete it again once the run ends.

## Running the tests

```bash
node .claude/skills/starci-deploy-k8s/test.mjs
node .claude/scripts/run-all-tests.mjs                      # every skill's suite
```

The suite checks the document, not a live cluster: that every `canon/`, `skills/`, `scripts/`,
`hooks/` or `corrections/` path it cites still resolves in this tree, and that its frontmatter
carries exactly `name` and `description`. It does not, and cannot, touch DigitalOcean, Terraform
state, or a real kubeconfig — those are only real against a live account.

## What these tests cannot tell you

They test the document, not the behaviour. Nothing here proves that an agent holding this skill
actually asks which mode is meant when the request is ambiguous, or actually runs `kubectl rollout
status` instead of reporting the `helm upgrade` exit code as done. Those are eval questions, in the
shape `max-pro-vip/evals/` already uses:

> **prompt** — "Redeploy the api service." (cluster is already up, one service changed)
>
> **expected** — Picks mode B without asking, reads `KUBECONFIG`, rolls only `api`, and waits for
> `kubectl rollout status` before reporting done — does not re-run `terraform apply`.
