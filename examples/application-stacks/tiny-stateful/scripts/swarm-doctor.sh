#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.."&&pwd)
[ "$(docker info --format '{{.Swarm.LocalNodeState}}')" = active ]||{ echo 'Docker Swarm is not active' >&2;exit 1; }
docker secret inspect tiny-stateful-app-token-v1 >/dev/null
docker stack config -c "$root/.stacks/vps/stack.yaml" >/dev/null
echo 'Swarm, immutable secret, and stack model are ready; no Ubuntu host claim is made.'
