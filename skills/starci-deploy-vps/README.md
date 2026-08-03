# starci-deploy-vps — why this exists

StarCi Academy already deploys to a VPS the simplest way that works: one `docker compose` service on
one droplet, and a self-hosted GitHub Actions runner on that box that rebuilds and restarts it on every
push to `main`. It works, but standing it up is spread across places — the runner is registered by hand,
the domain is pointed through Cloudflare out of band, and the repo's Actions secrets are set one at a
time.

This skill collapses that into one grounded pass: given the project's secrets **in the environment**, it
prepares the box over SSH, points the domain through Cloudflare, generates and pushes the deploy
workflow, and injects the secrets the workflow needs. After it runs, the pipeline is complete and a push
to `main` ships.

The one rule it never bends: **no credential is written to disk.** Values live only in environment
variables (`<PROJECT>_<NAME>`), resolved at the moment they are used and piped straight into `gh` —
because this skill set is a public repository, and a deploy tool that leaves a VPS password on disk is a
worse problem than a manual deploy. `test.mjs` guards that stance.
