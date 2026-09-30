param([Parameter(Mandatory = $true)][string]$DataDirectory)
$ErrorActionPreference = 'Stop'
$expected = [IO.Path]::GetFullPath((Join-Path $DataDirectory 'outlier-host\com.nebvoice.outlier.json'))
$registryPath = 'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.nebvoice.outlier'
if (Test-Path -LiteralPath $registryPath) {
  $registered = (Get-Item -LiteralPath $registryPath).GetValue('')
  if ([IO.Path]::GetFullPath($registered) -ne $expected) { throw 'La registrazione appartiene a un’altra istanza NEB; non viene rimossa.' }
  Remove-Item -LiteralPath $registryPath
}
Write-Output 'Registrazione rimossa. I progetti e le impostazioni sono conservati.'
