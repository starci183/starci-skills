#!/bin/sh
set -eu
env_name=${1:-dev};case "$env_name" in dev|vps);;*) exit 2;;esac
root=$(CDPATH= cd -- "$(dirname -- "$0")/.."&&pwd);env_dir="$root/.stacks/$env_name";key=${2:-"$HOME/.config/starci/application-stacks/tiny-stateful/$env_name.agekey"};ok=1
for file in "$env_dir/secrets.yaml.enc" "$env_dir/secrets.yaml" "$key";do [ -f "$file" ]||{ echo "missing: $file" >&2;ok=0;};done
docker compose -f "$env_dir/compose.yaml" config --quiet||ok=0;[ "$ok" = 1 ]||exit 1;echo "$env_name stack preparation is structurally ready; no live endpoint was tested."
