#requires -Version 7.0
param([ValidateSet('dev')][string]$Environment='dev')
$ErrorActionPreference='Stop';$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path;$EnvDir=Join-Path $Root '.stacks/dev';$Compose=Join-Path $EnvDir 'compose.yaml';$Secret=Join-Path $EnvDir 'secrets.yaml'
if(Test-Path -LiteralPath $Secret){$item=Get-Item -LiteralPath $Secret -Force;if($item.PSIsContainer-or($item.Attributes-band[IO.FileAttributes]::ReparsePoint)){throw 'refusing non-regular or reparse-point secret path'}}
$running=docker compose -p tiny-stateful-dev -f $Compose ps -q;if($LASTEXITCODE){throw 'could not confirm selected project is stopped'};if(($running|Where-Object{$_}).Count){throw 'selected Compose project is still running; stop it before cleanup'}
Remove-Item -LiteralPath $Secret -Force -ErrorAction SilentlyContinue;Write-Host 'Removed only the materialized dev secret. Ciphertext, marker and age key remain.'
