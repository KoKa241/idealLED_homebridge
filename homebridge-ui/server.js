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

    this.ready();
  }
}

(() => {
  return new PluginUiServer();
})();
