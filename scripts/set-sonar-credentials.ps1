[CmdletBinding()]
param(
    [string]$SourceRoot = '',
    [string]$HostUrl = 'https://sonar.starci.org',
    [switch]$Execute,
    [switch]$Rotate
)

$ErrorActionPreference = 'Stop'
if ([System.Environment]::OSVersion.Platform -ne [System.PlatformID]::Win32NT) {
    throw 'set-sonar-credentials.ps1 is Windows-only; use sonar-source-credentials.mjs from the host-native interactive wrapper.'
}
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($SourceRoot)) {
    $SourceRoot = (Resolve-Path (Join-Path $scriptRoot '..\..')).Path
}
$bootstrap = Join-Path $scriptRoot 'sonar-source-credentials.mjs'
$arguments = @($bootstrap, '--source', $SourceRoot, '--host', $HostUrl)
if ($Rotate) { $arguments += '--rotate' }

if (-not $Execute) {
    & node @arguments --plan
    exit $LASTEXITCODE
}

& node @arguments --check-authority
if ($LASTEXITCODE -eq 0) {
    '{}' | & node @arguments --execute
    if ($LASTEXITCODE -ne 0) { throw "Sonar credential bootstrap exited $LASTEXITCODE." }
    exit 0
}

$login = Read-Host 'Sonar operator login'
if ([string]::IsNullOrWhiteSpace($login)) { throw 'Sonar operator login is required.' }
$securePassword = Read-Host 'Sonar operator password (hidden; never paste it into chat)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$password = $null
try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    if ([string]::IsNullOrWhiteSpace($password)) { throw 'Empty password; nothing was changed.' }
    $envelope = @{ login = $login; password = $password } | ConvertTo-Json -Compress
    $envelope | & node @arguments --execute
    if ($LASTEXITCODE -ne 0) { throw "Sonar credential bootstrap exited $LASTEXITCODE." }
}
finally {
    $password = $null
    $envelope = $null
    if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $securePassword.Dispose()
}
