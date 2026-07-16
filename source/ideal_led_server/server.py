import asyncio
import os
import sys
import argparse

# Add the directory containing server.py to Python path to allow running it from anywhere
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from aiohttp import web
from bleak import BleakScanner
from idealled import IDEALLEDInstance
import logging

logging.basicConfig(level=logging.DEBUG)
LOGGER = logging.getLogger("idealLED_server")

# Global dict to hold IDEALLEDInstance objects
instances = {}

async def discover_devices(request):
    try:
        LOGGER.info("Starting BLE discovery...")
        devices = await BleakScanner.discover(timeout=5.0)
        supported_devices = []
        for d in devices:
            if d.name and (d.name.lower().startswith("isp-") or d.name.lower().startswith("idl-")):
                supported_devices.append({"mac": d.address, "name": d.name})
        LOGGER.info(f"Discovered {len(supported_devices)} supported devices.")
        return web.json_response({"devices": supported_devices})
    except Exception as e:
        LOGGER.error(f"Error during discovery: {e}")
        return web.json_response({"error": str(e)}, status=500)

async def test_flicker(request):
    mac = request.match_info.get('mac')
    try:
        LOGGER.info(f"Testing flicker for {mac}")
        if mac not in instances:
            instances[mac] = IDEALLEDInstance(mac, delay=10, fw_version="0.0.1")
        instance = instances[mac]
        
        await instance.update()
        fw_version = await instance._read_descr()
        instance._firmware_version = fw_version
        instance._detect_model()
        
        await instance.turn_on()
        await asyncio.sleep(1)
        await instance.turn_off()
        await asyncio.sleep(1)
        await instance.turn_on()
        await asyncio.sleep(1)
        await instance.turn_off()
        
        fw_str = fw_version.decode('utf-8', errors='ignore').strip('\x00') if isinstance(fw_version, bytearray) else fw_version
        return web.json_response({"status": "success", "fw_version": fw_str})
    except Exception as e:
        LOGGER.error(f"Error during flicker test for {mac}: {e}")
        if mac in instances:
            await instances[mac].stop()
            del instances[mac]
        return web.json_response({"error": str(e)}, status=500)

async def control_device(request):
    mac = request.match_info.get('mac')
    try:
        data = await request.json()
        command = data.get("command")
        
        if mac not in instances:
            fw_version = data.get("fw_version", "0.0.1")
            delay = data.get("delay", 7200)
            instances[mac] = IDEALLEDInstance(mac, delay=delay, fw_version=fw_version)
            
        instance = instances[mac]
        
        if command == "turn_on":
            await instance.turn_on()
        elif command == "turn_off":
            await instance.turn_off()
        elif command == "set_brightness":
            brightness = data.get("brightness", 255)
            await instance.set_brightness(brightness)
        elif command == "set_rgb_color":
            hs_col = data.get("hs_color")
            brightness = data.get("brightness")
            await instance.set_rgb_color(hs_col, brightness)
        elif command == "set_effect":
            effect = data.get("effect")
            brightness = data.get("brightness")
            await instance.set_effect(effect, brightness)
        elif command == "set_effect_speed":
            speed = data.get("speed")
            await instance.set_effect_speed(speed)
        elif command == "update":
            await instance.update()
        else:
            return web.json_response({"error": "Unknown command"}, status=400)
            
        return web.json_response({"status": "success"})
    except Exception as e:
        LOGGER.error(f"Error controlling {mac}: {e}")
        return web.json_response({"error": str(e)}, status=500)

async def get_state(request):
    mac = request.match_info.get('mac')
    if mac not in instances:
        LOGGER.info(f"Auto-instantiating device {mac} during state request")
        instances[mac] = IDEALLEDInstance(mac, delay=7200, fw_version="0.0.1")
        try:
            await asyncio.wait_for(instances[mac].update(), timeout=5.0)
        except Exception as e:
            LOGGER.warning(f"Initial update failed for {mac} on state request: {e}")
    
    instance = instances[mac]
    state = {
        "is_on": instance.is_on,
        "brightness": instance.brightness,
        "hs_color": instance.hs_color,
        "effect": instance.effect,
        "effect_speed": instance._effect_speed,
        "color_mode": instance.color_mode,
        "firmware_version": instance.firmware_version
    }
    return web.json_response({"status": "success", "state": state})

app = web.Application()
app.router.add_get('/api/discover', discover_devices)
app.router.add_post('/api/device/{mac}/test', test_flicker)
app.router.add_post('/api/device/{mac}/command', control_device)
app.router.add_get('/api/device/{mac}/state', get_state)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="iDeal LED Standalone HTTP Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host IP to bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8282, help="Port to bind (default: 8282)")
    args = parser.parse_args()
    
    LOGGER.info(f"Starting iDeal LED HTTP Server on {args.host}:{args.port}")
    web.run_app(app, host=args.host, port=args.port)
