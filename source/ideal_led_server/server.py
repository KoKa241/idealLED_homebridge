"""Shared HTTP control and last successfully commanded state for iDeal LED."""
import argparse
import asyncio
import logging
import math

from aiohttp import web
from bleak import BleakScanner
from idealled import EFFECT_LIST, IDEALLEDInstance

LOGGER = logging.getLogger("idealLED_server")
INSTANCES = web.AppKey("instances", dict)
LOCKS = web.AppKey("locks", dict)
STATE_FIELDS = ("is_on", "brightness", "hs_color", "effect", "effect_speed", "color_mode")


def device_key(request):
    return request.match_info["mac"].upper()


def state_of(instance):
    state = {field: getattr(instance, "_" + field) for field in STATE_FIELDS}
    state["firmware_version"] = instance.firmware_version
    return state


def number(data, key, low, high, *, integer=False):
    value = data.get(key)
    if (isinstance(value, bool) or not isinstance(value, (int, float))
            or not math.isfinite(value) or not low <= value <= high
            or (integer and int(value) != value)):
        raise ValueError(f"{key} must be {'an integer' if integer else 'a number'} from {low} to {high}")


def validate(data):
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object")
    command = data.get("command")
    if command not in {"turn_on", "turn_off", "set_brightness", "set_rgb_color", "set_effect", "set_effect_speed", "update"}:
        raise ValueError("Unknown command")
    if command == "set_brightness" or data.get("brightness") is not None:
        number(data, "brightness", 0, 255, integer=True)
    if command == "set_rgb_color":
        hs = data.get("hs_color")
        if not isinstance(hs, list) or len(hs) != 2:
            raise ValueError("hs_color must be [hue, saturation]")
        number({"hue": hs[0]}, "hue", 0, 360)
        number({"saturation": hs[1]}, "saturation", 0, 100)
    if command == "set_effect" and data.get("effect") not in EFFECT_LIST:
        raise ValueError("Unsupported effect")
    if command == "set_effect_speed":
        number(data, "speed", 1, 100, integer=True)
    if "delay" in data:
        number(data, "delay", 0, 86400, integer=True)
    if "fw_version" in data and not isinstance(data["fw_version"], str):
        raise ValueError("fw_version must be a string")


def instance_for(request, data=None):
    data = data or {}
    mac = device_key(request)
    instances = request.app[INSTANCES]
    if mac not in instances:
        instances[mac] = IDEALLEDInstance(mac, delay=data.get("delay", 7200), fw_version=data.get("fw_version", "0.0.1"))
    instance = instances[mac]
    if data.get("fw_version") not in (None, "0.0.1"):
        instance._firmware_version = data["fw_version"]
        instance._model = instance._detect_model()
    if "delay" in data:
        instance._delay = data["delay"]
    return instance


def lock_for(request):
    return request.app[LOCKS].setdefault(device_key(request), asyncio.Lock())


async def discover_devices(request):
    try:
        devices = await BleakScanner.discover(timeout=5.0)
        return web.json_response({"devices": [
            {"mac": d.address.upper(), "name": d.name} for d in devices
            if d.name and d.name.lower().startswith(("isp-", "idl-"))
        ]})
    except Exception:
        LOGGER.exception("BLE discovery failed")
        return web.json_response({"error": "BLE discovery failed"}, status=503)


async def control_device(request):
    try:
        data = await request.json()
        validate(data)
    except (ValueError, TypeError):
        return web.json_response({"error": "Invalid command or parameters"}, status=400)
    async with lock_for(request):
        instance = instance_for(request, data)
        previous = state_of(instance)
        try:
            command = data["command"]
            if command in {"turn_on", "turn_off", "update"}:
                await getattr(instance, command)()
            elif command == "set_brightness":
                await instance.set_brightness(data["brightness"])
            elif command == "set_rgb_color":
                await instance.set_rgb_color(data["hs_color"], data.get("brightness"))
            elif command == "set_effect":
                await instance.set_effect(data["effect"], data.get("brightness"))
            elif command == "set_effect_speed":
                await instance.set_effect_speed(data["speed"])
        except Exception:
            # Failed writes must not publish optimistic values to other clients.
            for field in STATE_FIELDS:
                setattr(instance, "_" + field, previous[field])
            LOGGER.exception("Command failed for %s", device_key(request))
            return web.json_response({"error": "Bluetooth command failed"}, status=503)
        return web.json_response({"status": "success", "state": state_of(instance)})


async def get_state(request):
    async with lock_for(request):
        return web.json_response({"status": "success", "state": state_of(instance_for(request))})


async def test_flicker(request):
    async with lock_for(request):
        instance = instance_for(request)
        try:
            await instance.update()
            firmware = await instance._read_descr()
            if isinstance(firmware, (bytes, bytearray)):
                firmware = firmware.decode("utf-8", errors="replace").strip("\x00")
            instance._firmware_version = firmware
            instance._model = instance._detect_model()
            for action in (instance.turn_on, instance.turn_off, instance.turn_on, instance.turn_off):
                await action()
                await asyncio.sleep(1)
            return web.json_response({"status": "success", "fw_version": firmware})
        except Exception:
            LOGGER.exception("Flicker test failed")
            return web.json_response({"error": "Flicker test failed"}, status=503)


async def health(request):
    return web.json_response({"status": "success", "service": "idealLED"})


async def cleanup(app):
    await asyncio.gather(*(instance.stop() for instance in app[INSTANCES].values()), return_exceptions=True)


def create_app():
    app = web.Application(client_max_size=4096)
    app[INSTANCES] = {}
    app[LOCKS] = {}
    app.router.add_get('/api/health', health)
    app.router.add_get('/api/discover', discover_devices)
    app.router.add_post('/api/device/{mac}/test', test_flicker)
    app.router.add_post('/api/device/{mac}/command', control_device)
    app.router.add_get('/api/device/{mac}/state', get_state)
    app.on_cleanup.append(cleanup)
    return app


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8282)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    web.run_app(create_app(), host=args.host, port=args.port)
