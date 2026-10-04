param([Parameter(Mandatory = $true)][string]$DataDirectory)
$ErrorActionPreference = 'Stop'
$expected = [IO.Path]::GetFullPath((Join-Path $DataDirectory 'outlier-host\com.nebvoice.outlier.json'))
$registryPaths = @(
  'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.nebvoice.outlier',
  'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.nebvoice.outlier'
)
$owned = @()
foreach ($registryPath in $registryPaths) {
  if (Test-Path -LiteralPath $registryPath) {
    $registered = (Get-Item -LiteralPath $registryPath).GetValue('')
    if ([IO.Path]::GetFullPath($registered) -ne $expected) { throw "La registrazione appartiene a un'altra istanza NEB; nessuna registrazione viene rimossa." }
    $owned += $registryPath
  }
}
foreach ($registryPath in $owned) {
  Remove-Item -LiteralPath $registryPath
}
Write-Output 'Registrazioni Edge e Chrome rimosse. I progetti e le impostazioni sono conservati.'
