#!/usr/bin/env bash
# set-secrets.sh — prompt for this project's declared secrets and export them into THIS shell.
#
# SOURCE it, do not run it:
#     source .claude/scripts/workspace/set-secrets.sh
#
# The values live only in the current shell's environment — nothing is written to disk, so a
# public checkout of this skill set never carries a credential. The names come from the workspace
# manifest (`read-workspace-context.mjs --secrets`, printed as <PROJECT>_<NAME> per line); the
# deploy skills read them back with `read-workspace-context.mjs secret.<NAME>`.

_ws_dir="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
_vars="$(node "$_ws_dir/read-workspace-context.mjs" --secrets 2>/dev/null)"

if [ -z "$_vars" ]; then
    echo "This project declares no secrets yet. Add the names first, e.g.:"
    echo "  node $_ws_dir/register-workspace-source.mjs --secrets VPS_HOST,VPS_USER,VPS_PASS,CLOUDFLARE_TOKEN,GITHUB_TOKEN,CLAUDE_CODE_OAUTH_TOKEN"
else
    echo "Enter each value (input hidden; blank = leave unchanged). Values stay in THIS shell only."
    while IFS= read -r _var; do
        [ -z "$_var" ] && continue
        _cur="${!_var}"
        printf "  %s%s: " "$_var" "$( [ -n "$_cur" ] && printf ' [already set]' )"
        IFS= read -rs _val; echo
        [ -n "$_val" ] && export "$_var=$_val"
    done <<< "$_vars"
    echo "done — secrets exported into this shell (not written to disk)."
fi
unset _ws_dir _vars _var _cur _val
