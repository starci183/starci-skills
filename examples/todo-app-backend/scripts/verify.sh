#!/bin/sh
set -eu
env_name=${1:-dev};case "$env_name" in dev|vps);;*) exit 2;;esac
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd); compose="$root/.stacks/$env_name/compose.yaml"; secret="$root/.stacks/$env_name/secrets.yaml"
[ -f "$secret" ] || { echo 'run prepare first' >&2; exit 1; }
project="starci-kit-${env_name}-$$"; port=$((20000 + ($$ % 20000))); export STACK_PORT=$port
cleanup(){ docker compose -p "$project" -f "$compose" down --volumes --remove-orphans >/dev/null 2>&1 || true; };trap cleanup EXIT INT TERM
docker compose -p "$project" -f "$compose" config >/dev/null
docker compose -p "$project" -f "$compose" up -d --build
network="${project}_default"
first=$(docker run --rm --network "$network" -v "$secret:/run/secrets/app_token:ro" -v "$root/scripts:/probe:ro" node:22.22.0-alpine3.23 node /probe/probe.mjs http://gateway:8080 increment)
docker compose -p "$project" -f "$compose" down --remove-orphans
docker compose -p "$project" -f "$compose" up -d
second=$(docker run --rm --network "$network" -v "$secret:/run/secrets/app_token:ro" -v "$root/scripts:/probe:ro" node:22.22.0-alpine3.23 node /probe/probe.mjs http://gateway:8080 read)
[ "$first" = "$second" ] || { echo 'persistence proof failed' >&2; exit 1; }
echo "cold-start/recreate persistence proof passed for isolated project $project"
