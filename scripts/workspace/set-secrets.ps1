# set-secrets.ps1 — prompt for this project's declared secrets and set them in THIS PowerShell session.
#
# DOT-SOURCE it, do not just run it:
#     . .\.claude\scripts\workspace\set-secrets.ps1
#
# The values live only in this session's environment ($env:) — nothing is written to disk, so a
# public checkout of this skill set never carries a credential. The names come from the workspace
# manifest (read-workspace-context.mjs --secrets, one <PROJECT>_<NAME> per line); the deploy skills
# read them back with `read-workspace-context.mjs secret.<NAME>`.

$wsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$vars = & node (Join-Path $wsDir 'read-workspace-context.mjs') --secrets 2>$null

if (-not $vars) {
    Write-Host "This project declares no secrets yet. Add the names first, e.g.:"
    Write-Host "  node $wsDir\register-workspace-source.mjs --secrets VPS_HOST,VPS_USER,VPS_PASS,CLOUDFLARE_TOKEN,GITHUB_TOKEN,CLAUDE_CODE_OAUTH_TOKEN"
} else {
    Write-Host "Enter each value (input hidden; blank = leave unchanged). Values stay in THIS session only."
    foreach ($var in $vars) {
        if (-not $var) { continue }
        $cur = [Environment]::GetEnvironmentVariable($var)
        $tag = if ($cur) { ' [already set]' } else { '' }
        $secure = Read-Host -AsSecureString "  $var$tag"
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        $val = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        if ($val) { Set-Item -Path "Env:$var" -Value $val }
    }
    Write-Host "done — secrets set in this session (not written to disk)."
}
