(async () => {
  // Get the current configuration
  const pluginConfig = await homebridge.getPluginConfig();
  const config = pluginConfig.length ? pluginConfig[0] : { serverUrl: 'http://127.0.0.1:8282' };

  // Set the input values
  document.getElementById('serverUrl').value = config.serverUrl || 'http://127.0.0.1:8282';

  // Save Config Button
  document.getElementById('saveConfig').addEventListener('click', async () => {
    config.serverUrl = document.getElementById('serverUrl').value;
    
    await homebridge.updatePluginConfig([config]);
    await homebridge.savePluginConfig();
    homebridge.toast.success('Configuration saved.');
  });

  // Discover Devices Button
  document.getElementById('discoverBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('discoveryStatus');
    const listEl = document.getElementById('deviceList');
    
    statusEl.innerHTML = '<div style="display:flex;align-items:center"><div class="loader"></div>Discovering devices...</div>';
    listEl.innerHTML = '';
    
    try {
      const serverUrl = document.getElementById('serverUrl').value;
      const response = await homebridge.request('/discover', { serverUrl });
      
      if (response.devices && response.devices.length > 0) {
        statusEl.innerHTML = `Found ${response.devices.length} devices. They will be added automatically to HomeKit.`;
        
        response.devices.forEach(device => {
          const div = document.createElement('div');
          div.className = 'device-item';
          div.innerHTML = `
            <div class="device-info">
              <h3>${device.name}</h3>
              <p>${device.mac}</p>
            </div>
            <div><button class="btn btn-secondary" onclick="testDevice('${device.mac}', '${serverUrl}')">Test</button></div>
          `;
          listEl.appendChild(div);
        });
      } else {
        statusEl.innerHTML = 'No devices found. Make sure the server is running and BLE is available.';
      }
    } catch (e) {
      statusEl.innerHTML = `<span style="color:#ef5350">Error discovering devices: ${e.message}</span>`;
      console.error(e);
    }
  });

  // Global test function
  window.testDevice = async (mac, serverUrl) => {
    try {
      homebridge.toast.info(`Testing ${mac}...`);
      await homebridge.request('/test', { mac, serverUrl });
      homebridge.toast.success('Test command sent!');
    } catch (e) {
      homebridge.toast.error('Test failed: ' + e.message);
    }
  };
})();
