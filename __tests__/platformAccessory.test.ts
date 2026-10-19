import { IdealLEDAccessory } from '../src/platformAccessory';

const axios = require('axios');
jest.mock('axios');

describe('IdealLEDAccessory', () => {
  let platform: any;
  let accessory: any;
  let service: any;
  let mockLog: any;

  beforeEach(() => {
    jest.useFakeTimers();
    axios.get.mockReset();
    axios.post.mockReset();
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
        on: jest.fn(),
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

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const state = (overrides = {}) => ({is_on: true, brightness: 128, hs_color: [200,50], ...overrides});
  async function create() {
    axios.get.mockResolvedValue({data: {state: state()}});
    const instance = new IdealLEDAccessory(platform, accessory);
    await Promise.resolve();
    await Promise.resolve();
    await instance.syncState();
    return instance;
  }

  it('publishes changes from the shared server without sending a command', async () => {
    const instance = await create();
    axios.get.mockResolvedValue({data: {state: state({is_on:false, brightness:51, hs_color:[30,80]})}});
    await instance.syncState();
    expect(await instance.getOn()).toBe(false);
    expect(service.updateCharacteristic).toHaveBeenCalledWith('Brightness', 20);
    expect(service.updateCharacteristic).toHaveBeenCalledWith('Hue', 30);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('maps brightness with exact integer rounding and uses acknowledged state', async () => {
    const instance = await create();
    axios.post.mockResolvedValue({data:{state:state()}});
    await instance.setBrightness(50);
    expect(axios.post).toHaveBeenCalledWith(expect.any(String), {command:'set_brightness',brightness:128}, {timeout:60000});
    expect(await instance.getBrightness()).toBe(50);
  });

  it('serializes hue and saturation and preserves server brightness', async () => {
    const instance = await create();
    axios.post.mockResolvedValueOnce({data:{state:state({hs_color:[120,50]})}})
      .mockResolvedValueOnce({data:{state:state({hs_color:[120,80]})}});
    await Promise.all([instance.setHue(120), instance.setSaturation(80)]);
    expect(axios.post).toHaveBeenNthCalledWith(1, expect.any(String), {command:'set_rgb_color',hs_color:[120,50]}, {timeout:60000});
    expect(axios.post).toHaveBeenNthCalledWith(2, expect.any(String), {command:'set_rgb_color',hs_color:[120,80]}, {timeout:60000});
  });

  it('reports failed writes and recovers on the next poll', async () => {
    const instance = await create();
    axios.post.mockRejectedValue(new Error('offline'));
    await expect(instance.setOn(false)).rejects.toThrow('HAP Error');
    await expect(instance.getOn()).rejects.toThrow('HAP Error');
    await instance.syncState();
    expect(await instance.getOn()).toBe(true);
  });

  it('does not turn unknown power into false', async () => {
    const instance = await create();
    axios.get.mockResolvedValue({data:{state:state({is_on:null})}});
    await instance.syncState();
    await expect(instance.getOn()).rejects.toThrow('HAP Error');
  });

  it('polls every two seconds and cleans up on shutdown', async () => {
    await create();
    axios.get.mockClear();
    await jest.advanceTimersByTimeAsync(2000);
    expect(axios.get).toHaveBeenCalledTimes(1);
    platform.api.on.mock.calls.find((call: any[]) => call[0] === 'shutdown')[1]();
    await jest.advanceTimersByTimeAsync(10000);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('does not overlap polls while a request is pending', async () => {
    let resolve: any;
    axios.get.mockReturnValue(new Promise(r => {resolve = r;}));
    const instance = new IdealLEDAccessory(platform, accessory);
    await jest.advanceTimersByTimeAsync(10000);
    expect(axios.get).toHaveBeenCalledTimes(1);
    resolve({data:{state:state()}});
    await Promise.resolve();
    instance.stop();
  });
});
