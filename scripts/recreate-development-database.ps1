$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $repositoryRoot ".env.docker"

if (-not (Test-Path -LiteralPath $environmentPath)) {
  throw "The optional ignored .env.docker file is required. Copy .env.docker.example first."
}

$settings = @{}
foreach ($line in Get-Content -LiteralPath $environmentPath) {
  if ($line -match '^\s*([^#][A-Z0-9_]+)\s*=\s*"?([^"\r\n]+)"?\s*$') {
    $settings[$matches[1]] = $matches[2]
  }
}

if ($settings["STOCKFLOW_DB_NAME"] -ne "stockflow_dev") {
  throw "Refusing reset: STOCKFLOW_DB_NAME must be exactly stockflow_dev."
}

$databaseUrl = $settings["DATABASE_URL"]
if ($databaseUrl -notmatch '^postgresql://[^@]+@(127\.0\.0\.1|localhost):\d+/stockflow_dev\?') {
  throw "Refusing reset: DATABASE_URL must target localhost database stockflow_dev."
}

$directUrl = $settings["DIRECT_URL"]
if ($directUrl -notmatch '^postgresql://[^@]+@(127\.0\.0\.1|localhost):\d+/stockflow_dev\?') {
  throw "Refusing reset: DIRECT_URL must target localhost database stockflow_dev."
}

$env:DATABASE_URL = $databaseUrl
$env:DIRECT_URL = $directUrl
$env:STOCKFLOW_DATABASE_TARGET = "development-disposable"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)] [string] $Command,
    [Parameter(ValueFromRemainingArguments = $true)] [string[]] $Arguments
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command failed with exit code $LASTEXITCODE."
  }
}

Push-Location $repositoryRoot
try {
  Write-Host "Recreating only the disposable local stockflow_dev Compose database."
  Invoke-Checked docker compose --env-file .env.docker down --volumes
  Invoke-Checked docker compose --env-file .env.docker up -d --wait postgres
  Invoke-Checked npx prisma migrate deploy
  Invoke-Checked npm run db:seed
  Invoke-Checked npm run db:seed
  Invoke-Checked npm run db:verify
  Invoke-Checked npm run test:integration
  Invoke-Checked npx prisma migrate status
}
finally {
  Pop-Location
}
