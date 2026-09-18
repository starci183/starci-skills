#!/bin/sh
# Decrypts every DEMO-ONLY .enc secret this example ships under .starcistacks/dev/runtime/**, then runs
# the given command. The decrypted files are never committed (see the backend's .gitignore); the identity
# they are encrypted to is itself committed and documented as demo-only in runtime/env/KEYS.md.
#
# Usage: ./scripts/with-dev-secrets.sh <command...>
#   e.g. ./scripts/with-dev-secrets.sh docker compose -f .starcistacks/dev/infra/compose/compose.yaml up -d
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
env_dir="$root/.starcistacks/dev/runtime/env"
files_dir="$root/.starcistacks/dev/runtime/files"
export SOPS_AGE_KEY_FILE="$env_dir/demo.agekey"

sops_bin() {
  if command -v sops >/dev/null 2>&1; then
    sops "$@"
  else
    docker run --rm -e SOPS_AGE_KEY_FILE=/keys/key.txt \
      -v "$SOPS_AGE_KEY_FILE:/keys/key.txt:ro" -v "$root:/work" -w /work \
      ghcr.io/getsops/sops:v3.10.2 "$@"
  fi
}

# app.env.enc is a SOPS dotenv document: decrypt it back to dotenv shape.
sops_bin -d --input-type dotenv --output-type dotenv "$env_dir/app.env.enc" > "$env_dir/app.env"

# Every *.key.enc is a single value wrapped as {"data": "..."} so SOPS has a document to encrypt; unwrap
# it back to the raw value the compose secret/file expects.
for enc in "$files_dir"/*.key.enc; do
  [ -e "$enc" ] || continue
  plain="${enc%.enc}"
  sops_bin -d --input-type json --output-type json "$enc" \
    | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>process.stdout.write(JSON.parse(s).data))' \
    > "$plain"
done

echo "Decrypted dev secrets under .starcistacks/dev/runtime/**; running: $*" >&2
exec "$@"
