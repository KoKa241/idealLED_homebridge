const { HomebridgePluginUiServer } = require('@homebridge/plugin-ui-utils');
const axios = require('axios');

class PluginUiServer extends HomebridgePluginUiServer {
  constructor() {
    super();

    // Handle discovery request
    this.onRequest('/discover', async (payload) => {
      try {
        const response = await axios.get(`${payload.serverUrl}/api/discover`);
        return response.data;
      } catch (e) {
        throw new Error(e.message);
      }
    });

    // Handle test request
    this.onRequest('/test', async (payload) => {
      try {
        const response = await axios.post(`${payload.serverUrl}/api/device/${payload.mac}/test`);
        return response.data;
      } catch (e) {
        throw new Error(e.message);
      }
    });

    // Handle effect request
    this.onRequest('/setEffect', async (payload) => {
      try {
        const response = await axios.post(`${payload.serverUrl}/api/device/${payload.mac}/command`, {
          command: 'set_effect',
          effect: payload.effect,
          brightness: 255
        });
        return response.data;
      } catch (e) {
        throw new Error(e.message);
      }
    });

    this.ready();
  }
}

(() => {
  return new PluginUiServer();
})();
