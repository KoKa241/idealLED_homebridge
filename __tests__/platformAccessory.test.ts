import { IdealLEDAccessory } from '../src/platformAccessory';

const axios = require('axios');
jest.mock('axios');

describe('IdealLEDAccessory', () => {
  let platform: any;
  let accessory: any;
  let service: any;
  let mockLog: any;

  beforeEach(() => {
    mockLog = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };

    service = {
      setCharacteristic: jest.fn().mockReturnThis(),
      getCharacteristic: jest.fn().mockReturnValue({
        onSet: jest.fn().mockReturnThis(),
        onGet: jest.fn().mockReturnThis(),
      }),
      updateCharacteristic: jest.fn(),
    };

    platform = {
      log: mockLog,
      serverUrl: 'http://127.0.0.1:8282',
      Service: {
        AccessoryInformation: 'AccessoryInformation',
        Lightbulb: 'Lightbulb',
      },
      Characteristic: {
        Manufacturer: 'Manufacturer',
        Model: 'Model',
        SerialNumber: 'SerialNumber',
        Name: 'Name',
        On: 'On',
        Brightness: 'Brightness',
        Hue: 'Hue',
        Saturation: 'Saturation',
      },
      api: {
        hap: {
          HAPStatus: {
            SERVICE_COMMUNICATION_FAILURE: -70402
          },
          HapStatusError: class HapStatusError extends Error {
            constructor(code: number) {
              super(`HAP Error ${code}`);
            }
          }
        }
      }
    };

    accessory = {
      context: {
        device: {
          mac: 'AA:BB:CC:DD:EE:FF',
          name: 'idl-test'
        }
      },
      getService: jest.fn().mockReturnValue(service),
      addService: jest.fn().mockReturnValue(service),
    };
    
    // Clear mocks
    jest.clearAllMocks();
  });

  it('should be initialized correctly', () => {
    axios.get.mockResolvedValueOnce({ data: { state: { is_on: true, brightness: 255, hs_color: [120, 100] } } });
    new IdealLEDAccessory(platform, accessory);
    expect(accessory.getService).toHaveBeenCalled();
  });

  it('should set On characteristic', async () => {
    axios.post.mockResolvedValueOnce({ data: { status: 'success' } });
    const instance = new IdealLEDAccessory(platform, accessory);
    
    await instance.setOn(true);
    expect(axios.post).toHaveBeenCalledWith('http://127.0.0.1:8282/api/device/AA:BB:CC:DD:EE:FF/command', {
      command: 'turn_on'
    });
    
    await instance.setOn(false);
    expect(axios.post).toHaveBeenCalledWith('http://127.0.0.1:8282/api/device/AA:BB:CC:DD:EE:FF/command', {
      command: 'turn_off'
    });
  });

  it('should set Brightness characteristic correctly mapped', async () => {
    axios.post.mockResolvedValueOnce({ data: { status: 'success' } });
    const instance = new IdealLEDAccessory(platform, accessory);
    
    await instance.setBrightness(50); // 50%
    // 50% of 255 is 128
    expect(axios.post).toHaveBeenCalledWith('http://127.0.0.1:8282/api/device/AA:BB:CC:DD:EE:FF/command', {
      command: 'set_brightness',
      brightness: 128
    });
  });

  it('should set Hue and Saturation correctly', async () => {
    axios.post.mockResolvedValue({ data: { status: 'success' } });
    const instance = new IdealLEDAccessory(platform, accessory);
    
    // We must set brightness to something to calculate HW brightness
    await instance.setBrightness(100);
    jest.clearAllMocks();
    
    await instance.setHue(120);
    expect(axios.post).toHaveBeenCalledWith('http://127.0.0.1:8282/api/device/AA:BB:CC:DD:EE:FF/command', {
      command: 'set_rgb_color',
      hs_color: [120, 0],
      brightness: 255
    });

    jest.clearAllMocks();
    await instance.setSaturation(80);
    expect(axios.post).toHaveBeenCalledWith('http://127.0.0.1:8282/api/device/AA:BB:CC:DD:EE:FF/command', {
      command: 'set_rgb_color',
      hs_color: [120, 80],
      brightness: 255
    });
  });
  
  it('should fetch and sync state correctly', async () => {
    axios.get.mockResolvedValueOnce({ data: { state: { is_on: true, brightness: 128, hs_color: [200, 50] } } });
    const instance = new IdealLEDAccessory(platform, accessory);
    await instance.syncState();
    
    expect(service.updateCharacteristic).toHaveBeenCalledWith('On', true);
    expect(service.updateCharacteristic).toHaveBeenCalledWith('Brightness', 50); // 128 / 2.55 = 50.19 ~ 50
    expect(service.updateCharacteristic).toHaveBeenCalledWith('Hue', 200);
    expect(service.updateCharacteristic).toHaveBeenCalledWith('Saturation', 50);
  });
});
