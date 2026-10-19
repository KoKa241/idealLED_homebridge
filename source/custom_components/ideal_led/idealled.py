import asyncio
import logging
import aiohttp
from typing import Tuple
from datetime import timedelta
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.components.light import ColorMode
from homeassistant.helpers.aiohttp_client import async_get_clientsession

LOGGER = logging.getLogger(__name__)

EFFECT_MAP = {}
for i in range(1, 11):
    EFFECT_MAP[f"Effect {i:02d}"] = i

EFFECT_LIST = sorted(EFFECT_MAP)

class IDEALLEDInstance:
    def __init__(self, address: str, delay: int, fw_version: str, host: str, port: int, hass) -> None:
        self._mac = address
        self._delay = delay
        self._firmware_version = fw_version
        self._host = host
        self._port = port
        self._hass = hass
        
        self.name = f"IDL-{self._mac[-8:].replace(':', '')}"
        
        self._is_on = None
        self._hs_color = (0, 0)
        self._brightness = 255
        self._effect = None
        self._effect_speed = 50
        self._color_mode = ColorMode.HS
        
        # In a full implementation, we might still want model detection locally 
        # or just let the server handle it. We can set it to a default.
        self._model = "Remote_LED" 
        
        self._lock = asyncio.Lock()
        self.available = False
        self._unsubscribe = None
        self.local_callback = None
        self.speed_local_callback = None

    @property
    def mac(self):
        return self._mac

    @property
    def firmware_version(self):
        return self._firmware_version

    @property
    def is_on(self):
        return self._is_on

    @property
    def brightness(self):
        return self._brightness

    @property
    def hs_color(self):
        return self._hs_color

    @property
    def effect_list(self) -> list[str]:
        return EFFECT_LIST

    @property
    def effect(self):
        return self._effect

    @property
    def color_mode(self):
        return self._color_mode

    def start(self):
        """Poll shared server state independently of entity polling."""
        async def poll(_now):
            await self.update()
        self._unsubscribe = async_track_time_interval(self._hass, poll, timedelta(seconds=2))

    def _notify(self):
        for callback in (self.local_callback, self.speed_local_callback):
            if callback:
                callback()

    def _apply_state(self, state):
        self._is_on = state["is_on"]
        self._brightness = state["brightness"]
        self._hs_color = tuple(state["hs_color"])
        self._effect = state["effect"]
        self._effect_speed = state["effect_speed"]
        # HA advertises HS; effects do not change the supported color mode.
        self._color_mode = ColorMode.HS
        if state.get("firmware_version") not in (None, "0.0.1"):
            self._firmware_version = state["firmware_version"]
        self.available = True
        self._notify()

    async def _send_command(self, payload: dict):
        async with self._lock:
            session = async_get_clientsession(self._hass)
            url = f"http://{self._host}:{self._port}/api/device/{self._mac}/command"
            payload = {**payload, "fw_version": self._firmware_version, "delay": self._delay}
            try:
                async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=60)) as response:
                    response.raise_for_status()
                    data = await response.json()
                    self._apply_state(data["state"])
            except (aiohttp.ClientError, asyncio.TimeoutError):
                self.available = False
                self._notify()
                raise

    async def update(self):
        if self._lock.locked():
            return
        async with self._lock:
            session = async_get_clientsession(self._hass)
            url = f"http://{self._host}:{self._port}/api/device/{self._mac}/state"
            try:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=60)) as response:
                    response.raise_for_status()
                    self._apply_state((await response.json())["state"])
            except (aiohttp.ClientError, asyncio.TimeoutError, KeyError, TypeError) as error:
                self.available = False
                self._notify()
                LOGGER.debug("Failed to update server state: %s", error)

    async def turn_on(self):
        await self._send_command({"command": "turn_on"})

    async def turn_off(self):
        await self._send_command({"command": "turn_off"})

    async def set_brightness(self, brightness: int):
        await self._send_command({"command": "set_brightness", "brightness": brightness})

    async def set_rgb_color(self, hs_col: Tuple[int, int], brightness: int | None = None):
        await self._send_command({"command": "set_rgb_color", "hs_color": hs_col, "brightness": brightness})

    async def set_effect(self, effect: str, brightness: int | None = None):
        await self._send_command({"command": "set_effect", "effect": effect, "brightness": brightness})

    async def set_effect_speed(self, speed: int):
        await self._send_command({"command": "set_effect_speed", "speed": speed})

    async def stop(self):
        if self._unsubscribe:
            self._unsubscribe()
            self._unsubscribe = None
        self.local_callback = None
        self.speed_local_callback = None
