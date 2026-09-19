param(
  [string]$Root = "D:\Repositories\starci-academy-backend\.claude",
  [string]$Tag = "trial"
)

# v7-8 lane rebuild: regenerate _derived/** for both example trees with the upstream writers,
# then run the freshness gate twice (idempotency: a second --write pass must not change any byte).
$ErrorActionPreference = "Continue"
Set-Location $Root

$trees = @{
  "todo-be" = Join-Path $Root "examples\todo-app-backend\.starciwork"
  "ec-be"   = Join-Path $Root "examples\ecommerce-app-be\.starciwork"
}
$derivedFiles = @("index.yaml", "frontier.md", "critique.yaml", "critique.md")

function Digests([string]$label) {
  foreach ($name in "todo-be", "ec-be") {
    foreach ($f in $derivedFiles) {
      $p = Join-Path $trees[$name] "_derived\$f"
      if (Test-Path -LiteralPath $p) {
        $h = (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash
        "{0}  {1,-8}  {2,-14}  {3}" -f $label, $name, $f, $h
      } else {
        "{0}  {1,-8}  {2,-14}  MISSING" -f $label, $name, $f
      }
    }
  }
}

"=== pass 1: write ==="
Digests "pre "
foreach ($name in "todo-be", "ec-be") {
  $w = $trees[$name]
  "--- derive  $name"
  node scripts\example-derive.mjs --work $w --write 2>&1
  "  exit=$LASTEXITCODE"
  "--- critique $name"
  node scripts\example-critique.mjs --work $w --write 2>&1
  "  exit=$LASTEXITCODE"
}

"=== gate after pass 1 ==="
node scripts\check-example-derived.mjs 2>&1
"gate exit=$LASTEXITCODE"
Digests "p1  "

"=== pass 2: write again (idempotency: p1 == post) ==="
foreach ($name in "todo-be", "ec-be") {
  $w = $trees[$name]
  node scripts\example-derive.mjs --work $w --write > $null 2>&1
  node scripts\example-critique.mjs --work $w --write > $null 2>&1
}
Digests "post"

"=== gate after pass 2 ==="
node scripts\check-example-derived.mjs 2>&1
"gate exit=$LASTEXITCODE"
