import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { IdealLEDPlatform } from './platform';
import axios from 'axios';

interface DeviceState {
  is_on: boolean | null;
  brightness: number;
  hs_color: [number, number];
}

export class IdealLEDAccessory {
  private service: Service;
  private state = { On: false, Brightness: 100, Hue: 0, Saturation: 0 };
  private available = false;
  private queue: Promise<unknown> = Promise.resolve();
  private polling = false;
  private stopped = false;
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly platform: IdealLEDPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
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

  private get url() {
    return `${this.platform.serverUrl}/api/device/${this.accessory.context.device.mac}`;
  }

  private failure() {
    return new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private applyState(state: DeviceState) {
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
    } else {
      this.service.updateCharacteristic(this.platform.Characteristic.On, this.failure());
    }
    this.service.updateCharacteristic(this.platform.Characteristic.Brightness, this.state.Brightness);
    this.service.updateCharacteristic(this.platform.Characteristic.Hue, this.state.Hue);
    this.service.updateCharacteristic(this.platform.Characteristic.Saturation, this.state.Saturation);
    this.powerKnown = typeof state.is_on === 'boolean';
  }

  private powerKnown = false;

  private markUnavailable() {
    this.available = false;
    for (const name of ['On', 'Brightness', 'Hue', 'Saturation'] as const) {
      this.service.updateCharacteristic(this.platform.Characteristic[name], this.failure());
    }
  }

  async syncState() {
    if (this.polling || this.stopped) { return; }
    this.polling = true;
    try {
      await this.enqueue(async () => {
        if (this.stopped) { return; }
        const response = await axios.get(`${this.url}/state`, { timeout: 60000 });
        this.applyState(response.data.state);
      });
    } catch {
      this.markUnavailable();
      this.platform.log.debug(`Failed to sync state for ${this.accessory.context.device.mac}`);
    } finally {
      this.polling = false;
    }
  }

  private command(payload: () => Record<string, unknown>) {
    return this.enqueue(async () => {
      try {
        const response = await axios.post(`${this.url}/command`, payload(), { timeout: 60000 });
        this.applyState(response.data.state);
      } catch {
        this.markUnavailable();
        throw this.failure();
      }
    });
  }

  async setOn(value: CharacteristicValue) {
    await this.command(() => ({ command: value ? 'turn_on' : 'turn_off' }));
  }

  async setBrightness(value: CharacteristicValue) {
    await this.command(() => ({ command: 'set_brightness', brightness: Math.round(Number(value) * 255 / 100) }));
  }

  async setHue(value: CharacteristicValue) {
    await this.command(() => ({ command: 'set_rgb_color', hs_color: [Number(value), this.state.Saturation] }));
  }

  async setSaturation(value: CharacteristicValue) {
    await this.command(() => ({ command: 'set_rgb_color', hs_color: [this.state.Hue, Number(value)] }));
  }

  private read(name: keyof typeof this.state): CharacteristicValue {
    if (!this.available || (name === 'On' && !this.powerKnown)) { throw this.failure(); }
    return this.state[name];
  }

  async getOn() { return this.read('On'); }
  async getBrightness() { return this.read('Brightness'); }
  async getHue() { return this.read('Hue'); }
  async getSaturation() { return this.read('Saturation'); }
}
