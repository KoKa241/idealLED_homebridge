# iDeal LED Homebridge Plugin

<p align="center">
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://homebridge.io"><img src="https://img.shields.io/badge/Homebridge-1.8.0%2B-purple?logo=homebridge&logoColor=white" alt="Homebridge"></a>
</p>

A native Homebridge plugin adapted from the [idealLED Home Assistant integration](https://github.com/KoKa241/idealLED_Home_Assistant). It seamlessly connects to your Python backend server to manage and control your iDeal LED strips directly from Apple HomeKit.

## Features

- **HomeKit Integration**: Control the power state, brightness, hue, and saturation of your LED strips directly from the Apple Home app or via Siri.
- **Custom UI Configuration**: A modern, built-in Homebridge interface (Config UI X) to set up your backend server IP and Port.
- **Automatic Discovery**: Click "Discover" in the plugin settings to automatically find and test your LED strips via the backend server.
- **Background Sync**: Automatically polls the backend server every 10 seconds to keep HomeKit state synchronized with any external changes.

## Requirements

- **Homebridge v1.8.0** or later.
- A running instance of the **iDeal LED Python HTTP Server** (default port `8282`).
- A compatible iDeal LED strip (e.g., `idl-` or `isp-` devices) connected via Bluetooth to the backend server.

---

## Installation

### Option 1: Install via Homebridge CLI (Recommended)

Run the following command on your Homebridge host (e.g., Raspberry Pi) to install directly from the GitHub repository:

```bash
sudo hb-service add https://github.com/KoKa241/idealLED_homebridge.git
```

This will download the plugin, set it up, and restart Homebridge.

### Option 2: Install via npm (Global)

If you are not using `hb-service`, you can install it globally via npm:

```bash
npm install -g https://github.com/KoKa241/idealLED_homebridge.git
```

### Option 3: Development / Build from Source

1. **Clone the repository:**
   ```bash
   git clone https://github.com/KoKa241/idealLED_homebridge.git
   cd idealLED_homebridge
   ```
2. **Install dependencies and build:**
   ```bash
   npm install
   npm run build
   ```
3. **Link to Homebridge:**
   ```bash
   npm link
   ```
4. Restart your Homebridge instance.
