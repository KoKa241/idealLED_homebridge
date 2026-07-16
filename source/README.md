# iDeal LED control (Client-Server Fork)

![image](https://github.com/8none1/idealLED/assets/6552931/c5fcd8fc-440a-48dd-abe4-d6fdd2e4a422)

> **Note:** This is a personal fork of the original [iDealLED project by 8none1](https://github.com/8none1/idealLED).

This fork refactors the project into a **client-server architecture**. This is especially useful if your Home Assistant server does not have built-in Bluetooth capabilities, allowing you to run the Bluetooth client on a separate device that can communicate with the server.

## Supported Features

- On / Off
- Set RGB colour of entire strip
- Set brightness
- Set effect & effect speed
- Bulk paint entire strip using collections feature
- Automatic discovery of supported devices in Home Assistant

## Setup and Usage

This project uses a client-server architecture, meaning you need to run two parts: a Bluetooth server and the Home Assistant integration.

### 1. Run the Server
You must run the server on a device that has a working Bluetooth adapter (e.g., a Raspberry Pi, a separate Linux machine, or your local PC).

Navigate to the `ideal_led_server` directory, install the requirements, and run the server:
```bash
cd ideal_led_server
pip install -r requirements.txt
python3 server.py
```
*(You can also use the provided `run_server.sh` or `run_server.bat` scripts, or install it as a service using `install_service.py`)*

### 2. Home Assistant Installation

Add this repo to HACS as a custom repo:

1. Go to HACS -> Integrations -> Top right menu (⋮) -> Custom Repositories.
2. Paste the Github URL to this repo in the Repository box.
3. Choose the category `Integration` and click **Add**.
4. The repo should show up in HACS as a new integration. Click on it and choose `DOWNLOAD`.
5. Restart Home Assistant.
6. Go to Settings -> Devices & Services, click **Add Integration**, search for **iDeal Led**.
7. Enter the IP address and port of the server you started in Step 1.

## Debugging

If you're experiencing issues, you can enable debug logging for this integration by adding the following to your `configuration.yaml`:

```yaml
logger:
  default: info
  logs:
    custom_components.ideal_led: debug
```
