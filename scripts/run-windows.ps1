param(
  [ValidatePattern('^[A-Za-z0-9_-]+$')]
  [string]$Instance = 'dev'
)

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$destination = Join-Path $env:LOCALAPPDATA ("NEBVoiceConsole\$Instance")
$sourceLockHash = (Get-FileHash -LiteralPath (Join-Path $repo 'package-lock.json') -Algorithm SHA256).Hash
$installStamp = Join-Path $destination '.installed-lock-hash'
New-Item -ItemType Directory -Path $destination -Force | Out-Null

@(
  'package.json', 'package-lock.json', 'electron.vite.config.ts',
  'tsconfig.json', 'tsconfig.node.json', 'tsconfig.web.json', 'eslint.config.mjs'
) | ForEach-Object {
  Copy-Item -LiteralPath (Join-Path $repo $_) -Destination $destination -Force
}

foreach ($folder in @('src', 'scripts')) {
  $target = Join-Path $destination $folder
  if (Test-Path $target) { Remove-Item -LiteralPath $target -Recurse -Force }
  Copy-Item -LiteralPath (Join-Path $repo $folder) -Destination $target -Recurse -Force
}

if (-not $env:GEMINI_API_KEY) {
  $localEnv = Join-Path $repo '.env.local'
  if (Test-Path $localEnv) {
    $entry = Get-Content -LiteralPath $localEnv | Where-Object { $_ -match '^GEMINI_API_KEY=' } | Select-Object -First 1
    if ($entry) { $env:GEMINI_API_KEY = $entry.Substring('GEMINI_API_KEY='.Length).Trim() }
  }
}

Push-Location $destination
try {
  if (-not (Test-Path (Join-Path $destination 'node_modules')) -or
      -not (Test-Path $installStamp) -or
      (Get-Content -LiteralPath $installStamp -Raw).Trim() -ne $sourceLockHash) {
    & npm.cmd ci --no-audit
    if ($LASTEXITCODE -ne 0) { throw 'Windows dependency installation failed.' }
    Set-Content -LiteralPath $installStamp -Value $sourceLockHash
  }
  if (-not (Test-Path (Join-Path $destination 'node_modules\electron\path.txt'))) {
    & node.exe (Join-Path $destination 'node_modules\electron\install.js')
    if ($LASTEXITCODE -ne 0) { throw 'Windows Electron binary download failed.' }
  }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Windows production build failed.' }
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  if ($Instance -ne 'dev') { $env:NEB_INSTANCE = $Instance }
  & npm.cmd start
  if ($LASTEXITCODE -ne 0) { throw 'Windows Electron failed to start.' }
} finally {
  Pop-Location
}
