#!/usr/bin/env sh
set -eu

case "$(uname -s)" in
  Linux|Darwin) ;;
  *) echo "set-sonar-credentials.sh is POSIX-only; use the Windows PowerShell wrapper." >&2; exit 2 ;;
esac

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
source_root=$(CDPATH= cd -- "$script_dir/../.." && pwd)
host_url="https://sonar.starci.org"
execute=false
rotate=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --source) source_root=$2; shift 2 ;;
    --host) host_url=$2; shift 2 ;;
    --execute) execute=true; shift ;;
    --rotate) rotate=true; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

set -- "$script_dir/sonar-source-credentials.mjs" --source "$source_root" --host "$host_url"
[ "$rotate" = false ] || set -- "$@" --rotate
if [ "$execute" = false ]; then
  exec node "$@" --plan
fi

printf 'Sonar operator login: ' >&2
IFS= read -r sonar_login
printf 'Sonar operator password (hidden; never paste it into chat): ' >&2
stty -echo
IFS= read -r sonar_password
stty echo
printf '\n' >&2

cleanup() {
  sonar_login=''
  sonar_password=''
  envelope=''
}
trap cleanup EXIT HUP INT TERM

envelope=$(SONAR_LOGIN="$sonar_login" SONAR_PASSWORD="$sonar_password" node -e 'process.stdout.write(JSON.stringify({login:process.env.SONAR_LOGIN,password:process.env.SONAR_PASSWORD}))')
printf '%s' "$envelope" | node "$@" --execute
