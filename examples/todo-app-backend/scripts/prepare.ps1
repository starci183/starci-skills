#requires -Version 7.0
param([ValidateSet('dev','vps')][string]$Environment='dev',[string]$KeyFile='',[switch]$CipherOnly,[switch]$Initialize)
$ErrorActionPreference='Stop';$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if(($Environment -eq 'dev' -and $CipherOnly)-or($Environment -eq 'vps' -and -not $CipherOnly)){throw 'dev materializes its secret; vps requires -CipherOnly and retains no plaintext'}
if(-not $KeyFile){$KeyFile=Join-Path $HOME ".config/starci/application-stacks/tiny-stateful/$Environment.agekey"};$KeyFile=[IO.Path]::GetFullPath($KeyFile)
$relative=[IO.Path]::GetRelativePath($Root,$KeyFile);if($relative -eq '.' -or (-not $relative.StartsWith('..'+[IO.Path]::DirectorySeparatorChar))){throw 'age key must be outside the application root'}
$KeyDir=Split-Path $KeyFile;$EnvDir=Join-Path $Root ".stacks/$Environment";$Cipher=Join-Path $EnvDir 'secrets.yaml.enc';$Secret=Join-Path $EnvDir 'secrets.yaml';$Marker=Join-Path $EnvDir '.initialized'
function Assert-NoReparseAncestor([string]$Target){$cursor=[IO.Path]::GetFullPath($Target);while($cursor){if(Test-Path -LiteralPath $cursor){$item=Get-Item -LiteralPath $cursor -Force;if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw "custody path has a reparse ancestor: $cursor"}};$parent=Split-Path $cursor -Parent;if(-not $parent-or$parent-eq$cursor){break};$cursor=$parent}}
foreach($target in @($Root,$EnvDir,$KeyFile,$Cipher,$Secret,$Marker)){Assert-NoReparseAncestor $target}
foreach($target in @($KeyFile,$Cipher,$Secret,$Marker)){if(Test-Path -LiteralPath $target){$item=Get-Item -LiteralPath $target -Force;if(-not $item.PSIsContainer -and -not($item.Attributes-band[IO.FileAttributes]::ReparsePoint)){continue};throw "custody path is not a regular file: $target"}}
if(-not(Test-Path -LiteralPath $EnvDir -PathType Container)){throw "environment directory missing: $EnvDir"}
if(-not(Test-Path -LiteralPath $KeyDir)){New-Item -ItemType Directory -Path $KeyDir|Out-Null};Assert-NoReparseAncestor $KeyDir
$Custody=Join-Path $KeyDir '.tiny-stateful-custody';$created=$false;if(-not(Test-Path -LiteralPath $Custody)){New-Item -ItemType Directory -Path $Custody|Out-Null;$created=$true};Assert-NoReparseAncestor $Custody
if($created -and $IsWindows){icacls $Custody /inheritance:r /grant:r "${env:USERNAME}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F'|Out-Null}
$KeyTemp=Join-Path $Custody "key.$PID.tmp";$CipherTemp=Join-Path $EnvDir ".secrets.yaml.enc.$PID";$SecretTemp=Join-Path $EnvDir ".secrets.yaml.$PID";$MarkerTemp=Join-Path $EnvDir ".initialized.$PID"
try{
 $Age='alpine:3.21.3';$Sops='ghcr.io/getsops/sops:v3.10.2'
 if((Test-Path $Cipher)-and-not(Test-Path $KeyFile)){throw 'encrypted secrets exist but the caller-owned age key is missing; restore/import it'}
 if(-not(Test-Path $Cipher)){
  if(-not$Initialize){throw 'ciphertext is absent; pass -Initialize only for a confirmed fresh environment'};if(Test-Path $Marker){throw 'initialized environment is missing ciphertext; restore it'}
  if(-not(Test-Path $KeyFile)){docker run --rm $Age sh -c 'apk add --no-cache age=1.2.1-r5 >/dev/null && age-keygen' 2>$null|Set-Content -LiteralPath $KeyTemp -Encoding utf8;if($LASTEXITCODE-or-not(Test-Path $KeyTemp)-or(Get-Item $KeyTemp).Length-eq0){throw 'age-keygen container failed'};if($IsWindows){icacls $KeyTemp /inheritance:r /grant:r "${env:USERNAME}:F" 'SYSTEM:F'|Out-Null};[IO.File]::Move($KeyTemp,$KeyFile,$false)}
  $Recipient=(docker run --rm -v "${KeyDir}:/keys:ro" $Age sh -c 'apk add --no-cache age=1.2.1-r5 >/dev/null && age-keygen -y "$1"' -- "/keys/$(Split-Path $KeyFile -Leaf)").Trim();if($LASTEXITCODE-or-not$Recipient.StartsWith('age1')){throw 'could not derive age recipient'}
  $token=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant();$plain=@{app_token=$token}|ConvertTo-Json -Compress
  $encrypted=$plain|docker run --rm -i $Sops --encrypt --age $Recipient --input-type json --output-type yaml /dev/stdin;if($LASTEXITCODE){throw 'SOPS encryption failed'};[IO.File]::WriteAllText($CipherTemp,($encrypted-join"`n"),[Text.UTF8Encoding]::new($false));if((Get-Item $CipherTemp).Length-eq0){throw 'SOPS returned empty ciphertext'};[IO.File]::Move($CipherTemp,$Cipher,$false)
 }
 if($CipherOnly){docker run --rm -e SOPS_AGE_KEY_FILE=/keys/key.txt -v "${KeyFile}:/keys/key.txt:ro" -v "${EnvDir}:/work:ro" $Sops --decrypt /work/secrets.yaml.enc|Out-Null;if($LASTEXITCODE){throw 'SOPS validation failed; ciphertext and key were preserved'};Write-Host 'Validated VPS ciphertext and caller-owned key; no plaintext was retained.';return}
 $decoded=docker run --rm -e SOPS_AGE_KEY_FILE=/keys/key.txt -v "${KeyFile}:/keys/key.txt:ro" -v "${EnvDir}:/work:ro" $Sops --decrypt --input-type yaml --output-type yaml /work/secrets.yaml.enc;if($LASTEXITCODE){throw 'SOPS decryption failed; ciphertext and key were preserved'}
 [IO.File]::WriteAllText($SecretTemp,($decoded-join"`n"),[Text.UTF8Encoding]::new($false));if((Get-Item $SecretTemp).Length-eq0){throw 'decrypted secret is empty'};if($IsWindows){icacls $SecretTemp /inheritance:r /grant:r "${env:USERNAME}:F" 'SYSTEM:F'|Out-Null};[IO.File]::Move($SecretTemp,$Secret,$true)
 if(-not(Test-Path $Marker)){
  [IO.File]::WriteAllText($MarkerTemp,'',[Text.UTF8Encoding]::new($false));if($IsWindows){icacls $MarkerTemp /inheritance:r /grant:r "${env:USERNAME}:F" 'SYSTEM:F'|Out-Null}else{chmod 600 -- $MarkerTemp}
  try{[IO.File]::Move($MarkerTemp,$Marker,$false)}catch [IO.IOException]{if(-not(Test-Path $Marker)){throw}}
 }
 Write-Host 'Prepared dev runtime secret file; ciphertext and caller-owned age key were preserved.'
}finally{foreach($temp in @($KeyTemp,$CipherTemp,$SecretTemp,$MarkerTemp)){Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}}
