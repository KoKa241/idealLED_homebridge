"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdealLEDPlatform = void 0;
const settings_1 = require("./settings");
const platformAccessory_1 = require("./platformAccessory");
const axios_1 = __importDefault(require("axios"));
class IdealLEDPlatform {
    log;
    config;
    api;
    Service;
    Characteristic;
    accessories = [];
    serverUrl;
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.serverUrl = config.serverUrl || 'http://127.0.0.1:8282';
        this.log.debug('Finished initializing platform:', this.config.name);
        this.api.on('didFinishLaunching', () => {
            this.restoreCachedAccessories();
            this.discoverDevices();
        });
    }
    instantiatedAccessories = new Set();
    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }
    restoreCachedAccessories() {
        for (const accessory of this.accessories) {
            if (!this.instantiatedAccessories.has(accessory.UUID)) {
                this.log.info('Restoring cached accessory on startup:', accessory.displayName);
                new platformAccessory_1.IdealLEDAccessory(this, accessory);
                this.instantiatedAccessories.add(accessory.UUID);
            }
        }
    }
    async discoverDevices() {
        try {
            this.log.info('Discovering devices from server:', this.serverUrl);
            const response = await axios_1.default.get(`${this.serverUrl}/api/discover`);
            const devices = response.data.devices || [];
            for (const device of devices) {
                const uuid = this.api.hap.uuid.generate(device.mac);
                if (this.instantiatedAccessories.has(uuid)) {
                    this.log.debug('Device already active/restored:', device.name);
                    continue;
                }
                const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
                if (existingAccessory) {
                    this.log.info('Restoring existing accessory from cache during discovery:', existingAccessory.displayName);
                    new platformAccessory_1.IdealLEDAccessory(this, existingAccessory);
                    this.instantiatedAccessories.add(uuid);
                }
                else {
                    this.log.info('Adding new accessory:', device.name);
                    const accessory = new this.api.platformAccessory(device.name, uuid);
                    accessory.context.device = device;
                    new platformAccessory_1.IdealLEDAccessory(this, accessory);
                    this.accessories.push(accessory);
                    this.instantiatedAccessories.add(uuid);
                    this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
                }
            }
        }
        catch (error) {
            this.log.error('Failed to discover devices:', error);
        }
    }
}
exports.IdealLEDPlatform = IdealLEDPlatform;
//# sourceMappingURL=platform.js.map