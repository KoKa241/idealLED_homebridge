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
          div.style.marginBottom = '15px';
          div.style.padding = '10px';
          div.style.border = '1px solid #ddd';
          div.style.borderRadius = '5px';
          
          let effectOptions = '';
          for(let i=1; i<=10; i++) {
             const effectName = 'Effect ' + i.toString().padStart(2, '0');
             effectOptions += `<option value="${effectName}">${effectName}</option>`;
          }

          div.innerHTML = `
            <div class="device-info" style="margin-bottom: 10px;">
              <h3>${device.name}</h3>
              <p>${device.mac}</p>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
              <button class="btn btn-secondary" onclick="testDevice('${device.mac}', '${serverUrl}')">Test Power</button>
              <select id="effect_${device.mac.replace(/:/g, '')}" class="form-control" style="width: auto;">
                ${effectOptions}
              </select>
              <button class="btn btn-primary" onclick="setDeviceEffect('${device.mac}', '${serverUrl}')">Set Effect</button>
            </div>
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

  // Global effect function
  window.setDeviceEffect = async (mac, serverUrl) => {
    try {
      const selectId = 'effect_' + mac.replace(/:/g, '');
      const effect = document.getElementById(selectId).value;
      homebridge.toast.info(`Setting ${effect} for ${mac}...`);
      await homebridge.request('/setEffect', { mac, serverUrl, effect });
      homebridge.toast.success('Effect set successfully!');
    } catch (e) {
      homebridge.toast.error('Failed to set effect: ' + e.message);
    }
  };
})();
