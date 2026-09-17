#!/bin/sh
set -eu
umask 077
env_name=${1:-dev}; key_file=${2:-"${HOME}/.config/starci/application-stacks/tiny-stateful/${env_name}.agekey"}; shift $(( $# >= 2 ? 2 : $# ))
cipher_only=0; initialize=0
for arg in "$@"; do case "$arg" in --cipher-only) cipher_only=1;; --initialize) initialize=1;; *) echo "unknown option: $arg" >&2; exit 2;; esac; done
case "$env_name:$cipher_only" in dev:0|vps:1);; dev:1) echo 'dev preparation must materialize its runtime secret' >&2; exit 2;; *) echo 'vps preparation requires --cipher-only; persistent VPS plaintext is forbidden' >&2; exit 2;; esac
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P); case "$key_file" in /*);; *) key_file=$(pwd -P)/$key_file;; esac
case "$key_file" in "$root"|"$root"/*) echo 'age key must be outside the application root' >&2; exit 1;; esac
key_dir=$(dirname -- "$key_file"); env_dir="$root/.stacks/$env_name"; cipher="$env_dir/secrets.yaml.enc"; secret="$env_dir/secrets.yaml"; marker="$env_dir/.initialized"
check_path() { target=$1; current=/; oldIFS=$IFS; IFS=/; set -- ${target#/}; IFS=$oldIFS; for part do [ -n "$part" ] || continue; current=${current%/}/$part; [ ! -L "$current" ] || { echo "custody path has a symlink ancestor: $current" >&2; exit 1; }; done; }
for target in "$root" "$env_dir" "$key_file" "$cipher" "$secret" "$marker"; do check_path "$target"; done
for target in "$key_file" "$cipher" "$secret" "$marker"; do [ ! -e "$target" ] || [ -f "$target" ] || { echo "custody path is not a regular file: $target" >&2; exit 1; }; done
[ -d "$env_dir" ] || { echo "environment directory missing: $env_dir" >&2; exit 1; }
mkdir -p -- "$key_dir"; check_path "$key_dir"
custody="$key_dir/.tiny-stateful-custody"; if [ ! -e "$custody" ]; then mkdir -m 700 -- "$custody"; fi
[ -d "$custody" ] && [ ! -L "$custody" ] || { echo 'private custody staging directory is unsafe' >&2; exit 1; }
key_tmp="$custody/key.$$"; cipher_tmp="$env_dir/.secrets.yaml.enc.$$"; secret_tmp="$env_dir/.secrets.yaml.$$"; marker_tmp="$env_dir/.initialized.$$"; trap 'rm -f -- "$key_tmp" "$cipher_tmp" "$secret_tmp" "$marker_tmp"' EXIT HUP INT TERM
age_image=alpine:3.21.3; sops_image=ghcr.io/getsops/sops:v3.10.2
if [ -f "$cipher" ] && [ ! -f "$key_file" ]; then echo 'encrypted secrets exist but the caller-owned age key is missing; restore/import it' >&2; exit 1; fi
if [ -f "$key_file" ]; then mode=$(stat -c %a "$key_file"); [ $((0$mode & 077)) -eq 0 ] || { echo 'age key is readable outside its owner' >&2; exit 1; }; fi
if [ ! -f "$cipher" ]; then
 [ "$initialize" -eq 1 ] || { echo 'ciphertext is absent; pass --initialize only for a confirmed fresh environment' >&2; exit 1; }
 [ ! -f "$marker" ] || { echo 'initialized environment is missing ciphertext; restore it' >&2; exit 1; }
 if [ ! -f "$key_file" ]; then docker run --rm "$age_image" sh -c 'apk add --no-cache age=1.2.1-r5 >/dev/null && age-keygen' >"$key_tmp" 2>/dev/null; [ -s "$key_tmp" ] || exit 1; chmod 600 "$key_tmp"; mv -n -- "$key_tmp" "$key_file" || { echo 'refusing to replace an age key' >&2; exit 1; }; fi
 recipient=$(docker run --rm -v "$key_dir:/keys:ro" "$age_image" sh -c 'apk add --no-cache age=1.2.1-r5 >/dev/null && age-keygen -y "$1"' -- "/keys/$(basename -- "$key_file")")
 token=$(docker run --rm alpine:3.21.3 sh -c 'od -An -N32 -tx1 /dev/urandom | tr -d " \n"')
 printf '{"app_token":"%s"}' "$token" | docker run --rm -i "$sops_image" --encrypt --age "$recipient" --input-type json --output-type yaml /dev/stdin >"$cipher_tmp"
 [ -s "$cipher_tmp" ] || exit 1; chmod 600 "$cipher_tmp"; mv -n -- "$cipher_tmp" "$cipher" || { echo 'refusing to replace ciphertext' >&2; exit 1; }
fi
if [ "$cipher_only" -eq 1 ]; then
 docker run --rm -e SOPS_AGE_KEY_FILE=/keys/key.txt -v "$key_file:/keys/key.txt:ro" -v "$env_dir:/work:ro" "$sops_image" --decrypt /work/secrets.yaml.enc >/dev/null
 echo 'Validated VPS ciphertext and caller-owned key; no plaintext was retained.'; exit 0
fi
if ! docker run --rm -e SOPS_AGE_KEY_FILE=/keys/key.txt -v "$key_file:/keys/key.txt:ro" -v "$env_dir:/work:ro" "$sops_image" --decrypt --input-type yaml --output-type yaml /work/secrets.yaml.enc >"$secret_tmp"; then echo 'SOPS decryption failed; ciphertext and key were preserved' >&2; exit 1; fi
[ -s "$secret_tmp" ] || { echo 'decrypted secret is empty' >&2; exit 1; }; chmod 400 "$secret_tmp"; mv -f -- "$secret_tmp" "$secret"
if [ ! -f "$marker" ]; then
 : >"$marker_tmp"; chmod 600 "$marker_tmp"; mv -n -- "$marker_tmp" "$marker"
 [ -f "$marker" ] || { echo 'failed to create initialized marker' >&2; exit 1; }
fi
echo 'Prepared dev runtime secret file; ciphertext and caller-owned age key were preserved.'
