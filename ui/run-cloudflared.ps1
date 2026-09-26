$ErrorActionPreference = 'Stop'
Remove-Item Env:CF_TUNNEL_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:CF_API_TOKEN -ErrorAction SilentlyContinue
$cloudflared = (Get-Command cloudflared.exe -ErrorAction Stop).Source
$config = Join-Path $env:USERPROFILE '.cloudflared\harness.yml'
& $cloudflared tunnel --config $config run starci-harness
exit $LASTEXITCODE
