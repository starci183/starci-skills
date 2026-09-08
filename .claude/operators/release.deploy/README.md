# release.deploy

Deploys one immutable release to one authorized target and proves its steady state. It binds passing quality evidence, required migration proof, exact manifest and artifact digests, existing deploy authorization, a bounded probe plan and an exact rollback identity.

Every target effect uses observed compare-and-set revisions. The observation series has multiple timestamped health and readiness samples and includes a public probe. A rollout failure may take only approved reversible recovery for the same release. Exhausted recovery may restore only the authorized compatible predecessor by exact digest. Concurrent drift or uncertain completion stops mutation until fresh observation.

A done response includes `release-deployment` and `deployment-probes`. A rollback receipt reports the predecessor restored and does not claim the new release succeeded. Two feedback rounds never authorize duplicate rollout, recovery or rollback effects.

Tests are synthetic and make no registry, host, deployment or rollback calls. Run `python .claude/operators/release.deploy/tests/run.py`.
