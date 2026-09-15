#!/bin/sh
set -eu
env_name=${1:-dev}; [ "$env_name" = dev ] || { echo 'cleanup-runtime only removes dev materialization' >&2; exit 2; }
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P); env_dir="$root/.stacks/dev"; compose="$env_dir/compose.yaml"; secret="$env_dir/secrets.yaml"
[ ! -L "$secret" ] || { echo 'refusing symlinked secret path' >&2; exit 1; }; [ ! -e "$secret" ] || [ -f "$secret" ] || { echo 'secret path is not a regular file' >&2; exit 1; }
running=$(docker compose -p tiny-stateful-dev -f "$compose" ps -q 2>/dev/null || { echo 'could not confirm selected project is stopped' >&2; exit 1; })
[ -z "$running" ] || { echo 'selected Compose project is still running; stop it before cleanup' >&2; exit 1; }
rm -f -- "$secret"; echo 'Removed only the materialized dev secret. Ciphertext, marker and age key remain.'
