# Shared Bluetooth server

Run **one** server for both Home Assistant and Homebridge. Configure the same
server IP/port in both integrations and update all three components together.
The Homebridge repository contains a matching copy under `source/ideal_led_server`.
Do not start both copies at once.

## State synchronization

Both clients poll every 2 seconds. The server returns the last successfully
commanded power, brightness (0–255), hue/saturation, effect and effect speed.
Homebridge exposes power, brightness and colour; effects/speed remain HA features.
Successful POST responses also include the resulting state. Commands and reads
are serialized per device, including the flicker test; reads may therefore wait
for an ongoing BLE operation. Idle polling does not scan or write to Bluetooth.
HTTP requests have timeouts and polling resumes after server/network recovery.

Power is unknown after a server restart until an on/off command succeeds. Other
fields initially use defaults (brightness 255, colour [0,0], speed 50, no effect).
State is in memory, not a measurement of the strip. BLE notifications are not yet
decoded: changes from the vendor app, a remote, or power loss are not detected.
An HTTP-successful poll indicates server reachability, not BLE reachability.
A partially completed multi-packet BLE command can leave the physical strip in a
different state after failure; retry the desired command to reconcile it.

## Windows installation (64-bit)

Requirements: Windows with working Bluetooth/driver, Internet access, and
Microsoft App Installer (`winget`) if Python is not already installed for all
users at `C:\Program Files\Python311`. Stop any manually launched old server first.

Open **PowerShell as Administrator** in this directory:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install_windows.ps1
```

The installer installs machine-wide Python 3.11 when needed, copies the server to
`C:\Program Files\iDealLED`, creates a virtual environment, installs requirements,
and downloads [WinSW 2.12.0](https://github.com/winsw/winsw/releases/tag/v2.12.0).
It creates the `iDealLEDServer` Windows service (LocalSystem), delayed automatic
start, restart on failure, and rotating logs. It replaces the old same-named
logon task. Re-run the script from the updated source to update the installation.
The process stops on an installation error; inspect the error and rerun.

```powershell
# Optional custom port/location (reuse the same location when updating/removing)
.\install_windows.ps1 -Port 8282 -InstallDir 'C:\Program Files\iDealLED'
Get-Service iDealLEDServer
Restart-Service iDealLEDServer
Get-Content 'C:\Program Files\iDealLED\logs\iDealLEDServer.err.log' -Tail 50
# Remove service/firewall rule; keep files and logs
.\install_windows.ps1 -Uninstall
```

The firewall rule permits the chosen TCP port from the local subnet on
Private/Domain profiles only. The API has no authentication: use a trusted LAN,
not an Internet port forward. For clients on another subnet, adjust the firewall
rule explicitly. WinSW configuration follows its
[service configuration documentation](https://github.com/winsw/winsw/blob/v2.12.0/doc/xmlConfigFile.md);
Python installation uses Microsoft's [winget install](https://learn.microsoft.com/en-us/windows/package-manager/winget/install).

The health check verifies HTTP startup only. Verify Bluetooth from both clients
on the actual Windows machine. If the adapter/driver does not work under
LocalSystem, configure the service's Log On account in `services.msc` and grant
that account access to the installation/log directories.

## Manual verification after deployment

1. Point both integrations at this server, then restart/reload both clients.
2. Turn the strip on in HA; HomeKit should update within about 2 seconds after
   the BLE command completes. Repeat off, brightness and colour in both directions.
3. Select an effect/speed in HA; verify brightness still synchronizes. Changing
   colour in HomeKit should clear HA's active effect.
4. Stop the server: clients should report communication failure/unavailability
   after their request timeout. Restart and verify automatic polling recovery.
5. Reboot Windows and verify service startup before interactive login.

## Development tests

From the Home Assistant repository root, install the server requirements plus
`pytest` and `pytest-asyncio`, then run `python -m pytest`. Tests run an HTTP
server on localhost and mock only BLE transport (plus HA imports for client tests).
