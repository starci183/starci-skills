# git.publish

Publishes one approved Git boundary from the exact quality-verified commit. It validates the routed checkout and changed-file ownership, runs installed hooks without bypass, follows the route's merge policy, and creates or advances the remote ref using non-force fast-forward semantics. An optional annotated tag exists only when explicitly requested and authorized.

The operator never decides whether a change should exist, rebases a session branch, force-pushes, bypasses hooks or expands the approved boundary. Remote state is observed before publication and fetched afterward. If a push or tag result is uncertain, the remote is fetched before any retry; the effect is never blindly duplicated.

A done response includes `published-commit` and `git-publication`, backed by approval, hook, merge, before-state and read-back evidence. The feedback loop permits at most two evidence repairs and never authorizes a second external effect.

Tests are synthetic and local. They do not merge, commit, push or tag. Run `python .claude/operators/git.publish/tests/run.py`.
