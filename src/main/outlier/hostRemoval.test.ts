import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const powershell = process.platform === 'win32' ? 'powershell.exe' : '/mnt/c/windows/System32/WindowsPowerShell/v1.0/powershell.exe'

it.runIf(process.platform === 'win32' || existsSync(powershell))('removes owned browser registrations only after checking every configured browser', () => {
  const source = Buffer.from(readFileSync('scripts/outlier/remove-host.ps1', 'utf8')).toString('base64')
  const script = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$removeHost = [scriptblock]::Create([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadToEnd())))
$edge = 'HKCU:\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\com.nebvoice.outlier'
$chrome = 'HKCU:\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.nebvoice.outlier'
$own = 'C:\\NEB-Test-Instance\\outlier-host\\com.nebvoice.outlier.json'
$other = 'C:\\Another-NEB-Instance\\outlier-host\\com.nebvoice.outlier.json'
function Test-Path { param([string]$LiteralPath) return $registry.ContainsKey($LiteralPath) }
function Get-Item {
  param([string]$LiteralPath)
  $item = [pscustomobject]@{ Registered = $registry[$LiteralPath] }
  $item | Add-Member -MemberType ScriptMethod -Name GetValue -Value { param($name) return $this.Registered }
  return $item
}
function Remove-Item { param([string]$LiteralPath) $removed.Add($LiteralPath); $registry.Remove($LiteralPath) }
$results = foreach ($scenario in @('both-own', 'chrome-foreign', 'edge-foreign', 'chrome-only', 'none')) {
  $registry = @{}
  if ($scenario -in @('both-own', 'chrome-foreign', 'edge-foreign')) { $registry[$edge] = $own; $registry[$chrome] = $own }
  if ($scenario -eq 'chrome-foreign') { $registry[$chrome] = $other }
  if ($scenario -eq 'edge-foreign') { $registry[$edge] = $other }
  if ($scenario -eq 'chrome-only') { $registry[$chrome] = $own }
  $removed = New-Object 'Collections.Generic.List[string]'
  $failed = $false
  try { & $removeHost -DataDirectory 'C:\\NEB-Test-Instance' | Out-Null } catch { $failed = $true }
  @{ scenario = $scenario; failed = $failed; removed = @($removed.ToArray()); remaining = @($registry.Keys | Sort-Object) }
}
ConvertTo-Json -InputObject @($results) -Compress -Depth 4
`
  const output = execFileSync(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { input: source, encoding: 'utf8', timeout: 30_000, windowsHide: true })
  const edge = 'HKCU:\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\com.nebvoice.outlier'
  const chrome = 'HKCU:\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.nebvoice.outlier'
  expect(JSON.parse(output.trim())).toEqual([
    { scenario: 'both-own', failed: false, removed: [edge, chrome], remaining: [] },
    { scenario: 'chrome-foreign', failed: true, removed: [], remaining: [chrome, edge] },
    { scenario: 'edge-foreign', failed: true, removed: [], remaining: [chrome, edge] },
    { scenario: 'chrome-only', failed: false, removed: [chrome], remaining: [] },
    { scenario: 'none', failed: false, removed: [], remaining: [] }
  ])
}, 35_000)
