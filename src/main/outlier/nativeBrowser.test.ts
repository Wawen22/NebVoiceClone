import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const powershell = process.platform === 'win32' ? 'powershell.exe' : '/mnt/c/windows/System32/WindowsPowerShell/v1.0/powershell.exe'

it.runIf(process.platform === 'win32' || existsSync(powershell))('binds the native association only to Edge or Chrome foreground windows', () => {
  // Replace OS boundaries in a compiled copy; exercise the real native window policy.
  const source = readFileSync('scripts/outlier/NativeHost.cs', 'utf8')
    .replace('[DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();', 'static IntPtr GetForegroundWindow() { return new IntPtr(41); }')
    .replace('[DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr handle, out uint process);', 'static uint GetWindowThreadProcessId(IntPtr handle, out uint process) { process = 42; return 1; }')
    .replace('[DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);', 'static IntPtr GetAncestor(IntPtr hwnd, uint flags) { return hwnd; }')
    .replaceAll('Process.GetProcessById((int)pid).ProcessName', 'BrowserFixture.ProcessName')
    + '\npublic static class BrowserFixture { public static string ProcessName; }'
  const encodedSource = Buffer.from(source).toString('base64')
  const script = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$source = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadToEnd()))
$framework = [Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
$references = @((Join-Path $framework 'System.dll'), (Join-Path $framework 'System.Core.dll'), (Join-Path $framework 'System.Web.Extensions.dll'), (Join-Path $framework 'WPF\\UIAutomationClient.dll'), (Join-Path $framework 'WPF\\UIAutomationTypes.dll'), (Join-Path $framework 'WPF\\WindowsBase.dll'))
Add-Type -TypeDefinition $source -ReferencedAssemblies $references
$method = [NativeHost].GetMethod('EdgeWindow', [Reflection.BindingFlags]'NonPublic,Static')
$results = foreach ($name in @('msedge', 'chrome', 'firefox', 'NEBVoiceConsole')) {
  [BrowserFixture]::ProcessName = $name
  try { $window = $method.Invoke($null, @()); @{ process = $name; window = $window.ToInt64(); accepted = $true } }
  catch { @{ process = $name; accepted = $false } }
}
ConvertTo-Json -InputObject @($results) -Compress
`
  const output = execFileSync(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { input: encodedSource, encoding: 'utf8', timeout: 30_000, windowsHide: true })
  expect(JSON.parse(output.trim())).toEqual([
    { process: 'msedge', window: 41, accepted: true },
    { process: 'chrome', window: 41, accepted: true },
    { process: 'firefox', accepted: false },
    { process: 'NEBVoiceConsole', accepted: false }
  ])
}, 35_000)
