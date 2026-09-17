#!/bin/sh
set -eu
umask 077
[ "${1:-}" = create ]&&[ "${2:-}" = vps ]||{ echo 'usage: swarm-secret.sh create vps <external-age-key> [--initialize]' >&2;exit 2; }
key=${3:?external age key path required};initialize=${4:-};[ -z "$initialize" ]||[ "$initialize" = --initialize ]||{ echo 'unknown option' >&2;exit 2; }
root=$(CDPATH= cd -- "$(dirname -- "$0")/.."&&pwd);env_dir="$root/.stacks/vps";runtime_name=tiny-stateful-app-token-v1;tmp="$env_dir/.swarm-secret.$$"
trap 'rm -f -- "$tmp"' EXIT HUP INT TERM
if [ "$initialize" = --initialize ];then "$root/scripts/prepare.sh" vps "$key" --cipher-only --initialize;else "$root/scripts/prepare.sh" vps "$key" --cipher-only;fi
docker secret inspect "$runtime_name" >/dev/null 2>&1&&{ echo 'secret version exists; declare a new version' >&2;exit 1; }
if ! docker run --rm -e SOPS_AGE_KEY_FILE=/keys/key.txt -v "$key:/keys/key.txt:ro" -v "$env_dir:/work:ro" ghcr.io/getsops/sops:v3.10.2 --decrypt --input-type yaml --output-type yaml /work/secrets.yaml.enc >"$tmp";then echo 'decrypt failed; no Swarm secret was created' >&2;exit 1;fi
chmod 600 "$tmp";grep -Eq '^app_token: [a-f0-9]{64}$' "$tmp"||{ echo 'decrypted secret shape is invalid' >&2;exit 1; }
docker secret create "$runtime_name" "$tmp" >/dev/null
rm -f -- "$tmp";trap - EXIT HUP INT TERM
echo "Created immutable Swarm secret $runtime_name; no plaintext file was retained."
