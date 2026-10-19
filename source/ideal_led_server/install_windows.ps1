#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [string]$InstallDir = "$env:ProgramFiles\iDealLED",
    [ValidateRange(1, 65535)][int]$Port = 8282,
    [switch]$Uninstall
)
$ErrorActionPreference = 'Stop'
$ServiceName = 'iDealLEDServer'
$Wrapper = Join-Path $InstallDir 'iDealLEDServer.exe'
function Invoke-Checked([string]$File, [string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$File failed with exit code $LASTEXITCODE" }
}
if ($Uninstall) {
    if (Get-Service $ServiceName -ErrorAction SilentlyContinue) {
        Stop-Service $ServiceName
        Invoke-Checked $Wrapper @('uninstall')
    }
    Get-NetFirewallRule -Name $ServiceName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    Write-Host "Service removed. Files and logs retained in $InstallDir."
    exit
}
# A machine-wide Python installation is accessible before a user logs on.
$Python = Join-Path $env:ProgramFiles 'Python311\python.exe'
if (-not (Test-Path $Python)) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw 'Install Microsoft App Installer (winget), or install Python 3.11 for all users in Program Files\Python311, then rerun.'
    }
    Invoke-Checked 'winget' @('install', '--id', 'Python.Python.3.11', '--exact', '--scope', 'machine', '--silent', '--accept-package-agreements', '--accept-source-agreements')
}
if (-not (Test-Path $Python)) { throw "Machine-wide Python not found at $Python" }
if (Get-Service $ServiceName -ErrorAction SilentlyContinue) { Stop-Service $ServiceName }
# Retire the old logon task so two servers do not compete for the adapter/port.
$OldTask = Get-ScheduledTask -TaskName $ServiceName -ErrorAction SilentlyContinue
if ($OldTask) {
    Stop-ScheduledTask -InputObject $OldTask
    Unregister-ScheduledTask -InputObject $OldTask -Confirm:$false
}
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
foreach ($Name in @('server.py', 'idealled.py', 'const.py', 'requirements.txt')) {
    $Source = Join-Path $PSScriptRoot $Name
    $Destination = Join-Path $InstallDir $Name
    if ([IO.Path]::GetFullPath($Source) -ne [IO.Path]::GetFullPath($Destination)) {
        Copy-Item $Source $Destination -Force
    }
}
$Venv = Join-Path $InstallDir 'venv'
if (-not (Test-Path "$Venv\Scripts\python.exe")) { Invoke-Checked $Python @('-m', 'venv', $Venv) }
Invoke-Checked "$Venv\Scripts\python.exe" @('-m', 'pip', 'install', '-r', "$InstallDir\requirements.txt")
if (-not (Test-Path $Wrapper)) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe' -OutFile "$Wrapper.download" -UseBasicParsing
    Move-Item "$Wrapper.download" $Wrapper -Force
}
# XML uses BASE so paths with spaces and non-ASCII characters are preserved.
@"
<service>
  <id>$ServiceName</id>
  <name>iDeal LED Bluetooth Server</name>
  <description>Shared Bluetooth HTTP server for Home Assistant and Homebridge.</description>
  <executable>%BASE%\venv\Scripts\python.exe</executable>
  <arguments>-u "%BASE%\server.py" --host 0.0.0.0 --port $Port</arguments>
  <workingdirectory>%BASE%</workingdirectory>
  <startmode>Automatic</startmode>
  <delayedAutoStart>true</delayedAutoStart>
  <onfailure action="restart" delay="10 sec"/>
  <stoptimeout>20 sec</stoptimeout>
  <logpath>%BASE%\logs</logpath>
  <log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>5</keepFiles></log>
</service>
"@ | Set-Content (Join-Path $InstallDir 'iDealLEDServer.xml') -Encoding UTF8
if (-not (Get-Service $ServiceName -ErrorAction SilentlyContinue)) { Invoke-Checked $Wrapper @('install') }
Get-NetFirewallRule -Name $ServiceName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -Name $ServiceName -DisplayName 'iDeal LED HTTP (local network)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -Profile Private,Domain -RemoteAddress LocalSubnet | Out-Null
Start-Service $ServiceName
$Ready = $false
for ($Attempt = 0; $Attempt -lt 15; $Attempt++) {
    try {
        # This checks HTTP startup without scanning or switching a real strip.
        $Response = Invoke-WebRequest "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 2
        if ($Response.StatusCode -eq 200) { $Ready = $true; break }
    } catch { Start-Sleep -Seconds 1 }
}
if (-not $Ready) { throw "Service did not become ready. Inspect $InstallDir\logs and Get-Service $ServiceName." }
Write-Host "Installed $ServiceName on port $Port. Logs: $InstallDir\logs"
Write-Host 'Use the Windows server IP and this port in BOTH integrations.'
