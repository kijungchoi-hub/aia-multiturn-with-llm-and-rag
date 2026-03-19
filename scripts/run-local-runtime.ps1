$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
}

$envContent = Get-Content ".env" -ErrorAction SilentlyContinue
foreach ($line in $envContent) {
  if ($line -match "^\s*#" -or $line -notmatch "=") { continue }
  $name, $value = $line -split "=", 2
  [System.Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), "Process")
}

npm start
