param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-p]{32}$')][string]$ExtensionId,
  [Parameter(Mandatory = $true)][string]$DataDirectory,
  [switch]$CompileOnly
)
$ErrorActionPreference = 'Stop'
$hostDirectory = Join-Path $DataDirectory 'outlier-host'
New-Item -ItemType Directory -Path $hostDirectory -Force | Out-Null
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$acl = New-Object Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
$acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
$directoryInfo = New-Object IO.DirectoryInfo($hostDirectory)
$directoryInfo.SetAccessControl($acl)
$hostExe = Join-Path $hostDirectory 'NEBOutlierHost.exe'
Get-Process -Name NEBOutlierHost -ErrorAction SilentlyContinue | Stop-Process -Force
if (Test-Path -LiteralPath $hostExe) { Remove-Item -LiteralPath $hostExe -Force }
$framework = [Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
$references = @(
  (Join-Path $framework 'System.dll'), (Join-Path $framework 'System.Core.dll'),
  (Join-Path $framework 'System.Web.Extensions.dll'), (Join-Path $framework 'WPF\UIAutomationClient.dll'),
  (Join-Path $framework 'WPF\UIAutomationTypes.dll'), (Join-Path $framework 'WPF\WindowsBase.dll')
)
Add-Type -Path (Join-Path $PSScriptRoot 'NativeHost.cs') -ReferencedAssemblies $references -OutputAssembly $hostExe -OutputType ConsoleApplication
if ($CompileOnly) { Write-Output 'Compilazione host completata; nessuna registrazione nel browser.'; exit 0 }
$manifestPath = Join-Path $hostDirectory 'com.nebvoice.outlier.json'
$json = @{ name = 'com.nebvoice.outlier'; description = 'NEB Outlier native connector'; path = $hostExe; type = 'stdio'; allowed_origins = @("chrome-extension://$ExtensionId/") } | ConvertTo-Json
[IO.File]::WriteAllText($manifestPath, $json, (New-Object Text.UTF8Encoding($false)))
$registryPath = 'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.nebvoice.outlier'
New-Item -Path $registryPath -Force | Out-Null
Set-Item -LiteralPath $registryPath -Value $manifestPath
Write-Output 'Host NEB Outlier compilato e registrato per questo utente.'
