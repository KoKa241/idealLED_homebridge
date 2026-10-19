"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdealLEDAccessory = void 0;
const axios_1 = __importDefault(require("axios"));
class IdealLEDAccessory {
    platform;
    accessory;
    service;
    state = { On: false, Brightness: 100, Hue: 0, Saturation: 0 };
    available = false;
    queue = Promise.resolve();
    polling = false;
    stopped = false;
    timer;
    constructor(platform, accessory) {
        this.platform = platform;
        this.accessory = accessory;
        this.accessory.getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'iDeal LED')
            .setCharacteristic(this.platform.Characteristic.Model, 'LED Strip')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.mac);
        this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);
        this.service.getCharacteristic(this.platform.Characteristic.On).onSet(this.setOn.bind(this)).onGet(this.getOn.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.Brightness).onSet(this.setBrightness.bind(this)).onGet(this.getBrightness.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.Hue).onSet(this.setHue.bind(this)).onGet(this.getHue.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.Saturation).onSet(this.setSaturation.bind(this)).onGet(this.getSaturation.bind(this));
        void this.syncState();
        this.timer = setInterval(() => { void this.syncState(); }, 2000);
        this.platform.api.on('shutdown', () => this.stop());
    }
    stop() {
        this.stopped = true;
        clearInterval(this.timer);
    }
    get url() {
        return `${this.platform.serverUrl}/api/device/${this.accessory.context.device.mac}`;
    }
    failure() {
        return new this.platform.api.hap.HapStatusError(-70402 /* this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE */);
    }
    enqueue(work) {
        const result = this.queue.then(work);
        this.queue = result.catch(() => undefined);
        return result;
    }
    applyState(state) {
        if (!state || !Number.isFinite(state.brightness) || !Array.isArray(state.hs_color)) {
            throw new Error('Invalid server state');
        }
        this.available = true;
        this.state.Brightness = Math.round(state.brightness * 100 / 255);
        this.state.Hue = state.hs_color[0];
        this.state.Saturation = state.hs_color[1];
        if (typeof state.is_on === 'boolean') {
            this.state.On = state.is_on;
            this.service.updateCharacteristic(this.platform.Characteristic.On, this.state.On);
        }
        else {
            this.service.updateCharacteristic(this.platform.Characteristic.On, this.failure());
        }
        this.service.updateCharacteristic(this.platform.Characteristic.Brightness, this.state.Brightness);
        this.service.updateCharacteristic(this.platform.Characteristic.Hue, this.state.Hue);
        this.service.updateCharacteristic(this.platform.Characteristic.Saturation, this.state.Saturation);
        this.powerKnown = typeof state.is_on === 'boolean';
    }
    powerKnown = false;
    markUnavailable() {
        this.available = false;
        for (const name of ['On', 'Brightness', 'Hue', 'Saturation']) {
            this.service.updateCharacteristic(this.platform.Characteristic[name], this.failure());
        }
    }
    async syncState() {
        if (this.polling || this.stopped) {
            return;
        }
        this.polling = true;
        try {
            await this.enqueue(async () => {
                if (this.stopped) {
                    return;
                }
                const response = await axios_1.default.get(`${this.url}/state`, { timeout: 60000 });
                this.applyState(response.data.state);
            });
        }
        catch {
            this.markUnavailable();
            this.platform.log.debug(`Failed to sync state for ${this.accessory.context.device.mac}`);
        }
        finally {
            this.polling = false;
        }
    }
    command(payload) {
        return this.enqueue(async () => {
            try {
                const response = await axios_1.default.post(`${this.url}/command`, payload(), { timeout: 60000 });
                this.applyState(response.data.state);
            }
            catch {
                this.markUnavailable();
                throw this.failure();
            }
        });
    }
    async setOn(value) {
        await this.command(() => ({ command: value ? 'turn_on' : 'turn_off' }));
    }
    async setBrightness(value) {
        await this.command(() => ({ command: 'set_brightness', brightness: Math.round(Number(value) * 255 / 100) }));
    }
    async setHue(value) {
        await this.command(() => ({ command: 'set_rgb_color', hs_color: [Number(value), this.state.Saturation] }));
    }
    async setSaturation(value) {
        await this.command(() => ({ command: 'set_rgb_color', hs_color: [this.state.Hue, Number(value)] }));
    }
    read(name) {
        if (!this.available || (name === 'On' && !this.powerKnown)) {
            throw this.failure();
        }
        return this.state[name];
    }
    async getOn() { return this.read('On'); }
    async getBrightness() { return this.read('Brightness'); }
    async getHue() { return this.read('Hue'); }
    async getSaturation() { return this.read('Saturation'); }
}
exports.IdealLEDAccessory = IdealLEDAccessory;
//# sourceMappingURL=platformAccessory.js.map