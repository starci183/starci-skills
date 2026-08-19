[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Z][A-Z0-9_]*$')]
    [string]$Name,

    [string[]]$Stack = @(),
    [string[]]$Repo = @(),
    [string]$FromEnv,
    [switch]$Execute
)

$ErrorActionPreference = 'Stop'
if ([System.Environment]::OSVersion.Platform -ne [System.PlatformID]::Win32NT) {
    throw 'set-credential.ps1 is Windows-only; use publish-secret.mjs through an interactive POSIX shell.'
}
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$publisher = Join-Path $scriptRoot 'publish-secret.mjs'

if (($Stack.Count + $Repo.Count) -eq 0) {
    throw 'At least one -Stack or -Repo target is required.'
}

$sourceName = if ($FromEnv) { $FromEnv } else { $Name }
if ($sourceName -notmatch '^[A-Z][A-Z0-9_]*$') {
    throw '-FromEnv must name an uppercase process environment variable.'
}

$arguments = @($publisher, '--name', $Name, '--from-env', $sourceName)
foreach ($target in $Stack) { $arguments += @('--stack', $target) }
foreach ($target in $Repo) { $arguments += @('--repo', $target) }

if (-not $Execute) {
    & node @arguments --plan
    exit $LASTEXITCODE
}

$secureValue = Read-Host "Value for $Name (hidden; never paste it into chat)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
$plainValue = $null
try {
    $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    if ([string]::IsNullOrWhiteSpace($plainValue)) { throw 'Empty credential; nothing was changed.' }
    [Environment]::SetEnvironmentVariable($sourceName, $plainValue, 'Process')
    & node @arguments
    if ($LASTEXITCODE -ne 0) { throw "Credential publisher exited $LASTEXITCODE." }
}
finally {
    [Environment]::SetEnvironmentVariable($sourceName, $null, 'Process')
    $plainValue = $null
    if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $secureValue.Dispose()
}
