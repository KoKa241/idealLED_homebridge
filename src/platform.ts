import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { IdealLEDAccessory } from './platformAccessory';
import axios from 'axios';

export class IdealLEDPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public readonly accessories: PlatformAccessory[] = [];
  public readonly serverUrl: string;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;
    this.serverUrl = config.serverUrl || 'http://127.0.0.1:8282';
    
    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      this.restoreCachedAccessories();
      this.discoverDevices();
    });
  }

  private readonly instantiatedAccessories: Set<string> = new Set();

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  restoreCachedAccessories() {
    for (const accessory of this.accessories) {
      if (!this.instantiatedAccessories.has(accessory.UUID)) {
        this.log.info('Restoring cached accessory on startup:', accessory.displayName);
        new IdealLEDAccessory(this, accessory);
        this.instantiatedAccessories.add(accessory.UUID);
      }
    }
  }

  async discoverDevices() {
    try {
      this.log.info('Discovering devices from server:', this.serverUrl);
      const response = await axios.get(`${this.serverUrl}/api/discover`);
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
          new IdealLEDAccessory(this, existingAccessory);
          this.instantiatedAccessories.add(uuid);
        } else {
          this.log.info('Adding new accessory:', device.name);
          const accessory = new this.api.platformAccessory(device.name, uuid);
          accessory.context.device = device;
          new IdealLEDAccessory(this, accessory);
          this.accessories.push(accessory);
          this.instantiatedAccessories.add(uuid);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      }
    } catch (error) {
      this.log.error('Failed to discover devices:', error);
    }
  }
}
