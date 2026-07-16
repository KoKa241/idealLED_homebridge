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
    state = {
        On: false,
        Brightness: 100,
        Hue: 0,
        Saturation: 0,
    };
    constructor(platform, accessory) {
        this.platform = platform;
        this.accessory = accessory;
        this.accessory.getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'iDeal LED')
            .setCharacteristic(this.platform.Characteristic.Model, 'LED Strip')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.mac);
        this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);
        this.service.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setOn.bind(this))
            .onGet(this.getOn.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.Brightness)
            .onSet(this.setBrightness.bind(this))
            .onGet(this.getBrightness.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.Hue)
            .onSet(this.setHue.bind(this))
            .onGet(this.getHue.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.Saturation)
            .onSet(this.setSaturation.bind(this))
            .onGet(this.getSaturation.bind(this));
        // Initial sync
        this.syncState();
        // Periodically update state
        setInterval(() => {
            this.syncState();
        }, 10000); // 10 seconds
    }
    async syncState() {
        try {
            const res = await axios_1.default.get(`${this.platform.serverUrl}/api/device/${this.accessory.context.device.mac}/state`);
            if (res.data && res.data.state) {
                const s = res.data.state;
                this.state.On = s.is_on;
                this.state.Brightness = Math.round(s.brightness / 2.55);
                if (s.hs_color) {
                    this.state.Hue = s.hs_color[0];
                    this.state.Saturation = s.hs_color[1];
                }
                this.service.updateCharacteristic(this.platform.Characteristic.On, this.state.On);
                this.service.updateCharacteristic(this.platform.Characteristic.Brightness, this.state.Brightness);
                this.service.updateCharacteristic(this.platform.Characteristic.Hue, this.state.Hue);
                this.service.updateCharacteristic(this.platform.Characteristic.Saturation, this.state.Saturation);
            }
        }
        catch (e) {
            this.platform.log.debug(`Failed to sync state for ${this.accessory.context.device.mac}`);
        }
    }
    async setOn(value) {
        this.state.On = value;
        const command = this.state.On ? 'turn_on' : 'turn_off';
        try {
            await axios_1.default.post(`${this.platform.serverUrl}/api/device/${this.accessory.context.device.mac}/command`, {
                command
            });
            this.platform.log.info(`Set On -> ${value} for ${this.accessory.context.device.mac}`);
        }
        catch (e) {
            this.platform.log.error(`Failed to set On -> ${value} for ${this.accessory.context.device.mac}`);
            throw new this.platform.api.hap.HapStatusError(-70402 /* this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE */);
        }
    }
    async getOn() {
        return this.state.On;
    }
    async setBrightness(value) {
        this.state.Brightness = value;
        const hwBrightness = Math.round(this.state.Brightness * 2.55);
        try {
            await axios_1.default.post(`${this.platform.serverUrl}/api/device/${this.accessory.context.device.mac}/command`, {
                command: 'set_brightness',
                brightness: hwBrightness
            });
            this.platform.log.info(`Set Brightness -> ${value} for ${this.accessory.context.device.mac}`);
        }
        catch (e) {
            this.platform.log.error(`Failed to set Brightness for ${this.accessory.context.device.mac}`);
            throw new this.platform.api.hap.HapStatusError(-70402 /* this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE */);
        }
    }
    async getBrightness() {
        return this.state.Brightness;
    }
    async setHue(value) {
        this.state.Hue = value;
        await this.sendColorCommand();
    }
    async getHue() {
        return this.state.Hue;
    }
    async setSaturation(value) {
        this.state.Saturation = value;
        await this.sendColorCommand();
    }
    async getSaturation() {
        return this.state.Saturation;
    }
    async sendColorCommand() {
        const hwBrightness = Math.round(this.state.Brightness * 2.55);
        try {
            await axios_1.default.post(`${this.platform.serverUrl}/api/device/${this.accessory.context.device.mac}/command`, {
                command: 'set_rgb_color',
                hs_color: [this.state.Hue, this.state.Saturation],
                brightness: hwBrightness
            });
            this.platform.log.info(`Set Color -> H:${this.state.Hue} S:${this.state.Saturation} for ${this.accessory.context.device.mac}`);
        }
        catch (e) {
            this.platform.log.error(`Failed to set Color for ${this.accessory.context.device.mac}`);
            throw new this.platform.api.hap.HapStatusError(-70402 /* this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE */);
        }
    }
}
exports.IdealLEDAccessory = IdealLEDAccessory;
//# sourceMappingURL=platformAccessory.js.map