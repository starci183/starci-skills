# Analyze self-upgrade input

Select `calibrate` to reproduce, measure, check output stability twice, diagnose every required layer,
and publish evidence under `.claude/upgrades/` without changing an existing runtime owner. A wrong or
inconsistent output ends calibration as `blocked`, never `complete`.

Select `upgrade` only when the user has authorized the smallest named `.claude` write roots and the
same acceptance contract can be rerun after repair. Product source, deployment, publication, and
destructive cleanup remain outside both modes.
