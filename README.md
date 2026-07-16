# iDeal LED Homebridge Plugin

<p align="center">
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://homebridge.io"><img src="https://img.shields.io/badge/Homebridge-1.8.0%2B-purple?logo=homebridge&logoColor=white" alt="Homebridge"></a>
</p>

A native Homebridge plugin for my [iDeal LED](https://github.com/8none1/idealLED) fork. It seamlessly connects to your Python backend server to manage and control your iDeal LED strips directly from Apple HomeKit.

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

### Option 1: Install via Homebridge UI
1. Open your Homebridge Config UI X dashboard.
2. Go to the **Plugins** tab.
3. Search for `homebridge-ideal-led` and click **Install**.
4. Use the custom configuration screen to enter your Python Server URL (IP and port).

### Option 2: Build from Source
1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/idealLed_homebridge.git
   cd idealLed_homebridge
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
